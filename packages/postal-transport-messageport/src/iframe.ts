/**
 * High-level wrappers for connecting postal across an iframe boundary.
 *
 * - Parent calls `connectToIframe()` — creates a MessageChannel,
 *   transfers port2 to the iframe, waits for ACK.
 * - Iframe calls `connectToParent()` — listens for a SYN carrying
 *   a transferred port, sends ACK back.
 *
 * Both resolve with a Transport backed by their end of the port.
 *
 * @module
 */

import type { Transport } from "postal";
import type { ConnectOptions } from "./types";
import { DEFAULT_TIMEOUT, createSyn, createAck, isAck, isSyn } from "./protocol";
import { createMessagePortTransport } from "./messagePortTransport";
import { PostalHandshakeTimeoutError } from "./errors";

const DEFAULT_TARGET_ORIGIN = "*";

/**
 * Connects to a postal instance running inside an iframe.
 *
 * Called from the **parent** window. The iframe must call
 * `connectToParent()` to complete the handshake.
 *
 * @param iframe - The target iframe element (must be loaded)
 * @param options - Timeout and origin settings
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if the iframe doesn't ACK in time
 */
export const connectToIframe = (
    iframe: HTMLIFrameElement,
    options: ConnectOptions = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT, targetOrigin = DEFAULT_TARGET_ORIGIN } = options;

    return new Promise<Transport>((resolve, reject) => {
        if (!iframe.contentWindow) {
            reject(new Error("iframe.contentWindow is null — is the iframe loaded?"));
            return;
        }

        const channel = new MessageChannel();
        const { port1, port2 } = channel;

        const timer = setTimeout(() => {
            port1.removeEventListener("message", onAck);
            port1.close();
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onAck = (event: MessageEvent): void => {
            if (isAck(event.data)) {
                clearTimeout(timer);
                port1.removeEventListener("message", onAck);
                resolve(createMessagePortTransport(port1));
            }
        };

        port1.addEventListener("message", onAck);
        port1.start();

        iframe.contentWindow.postMessage(createSyn(), targetOrigin, [port2]);
    });
};

/**
 * Listens for a postal handshake initiated by the parent window.
 *
 * Called from **inside the iframe**. Waits for a SYN with a
 * transferred MessagePort, sends ACK back through it,
 * and resolves with a Transport wrapping the port.
 *
 * @param options - Timeout and origin settings
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if no SYN arrives in time
 */
export const connectToParent = (options: ConnectOptions = {}): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT, allowedOrigin = DEFAULT_TARGET_ORIGIN } = options;

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            globalThis.removeEventListener("message", onSyn);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onSyn = (event: MessageEvent): void => {
            if (allowedOrigin !== "*" && event.origin !== allowedOrigin) {
                return;
            }

            if (isSyn(event.data) && event.ports.length > 0) {
                clearTimeout(timer);
                globalThis.removeEventListener("message", onSyn);

                const port = event.ports[0];
                port.postMessage(createAck());
                resolve(createMessagePortTransport(port));
            }
        };

        globalThis.addEventListener("message", onSyn);
    });
};
