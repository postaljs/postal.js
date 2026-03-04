/**
 * High-level wrappers for connecting postal to a dedicated web worker.
 *
 * - Main thread calls `connectToWorker()` — creates a MessageChannel,
 *   transfers port2 to the worker, waits for ACK.
 * - Worker calls `connectToHost()` — listens for a SYN carrying
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

/**
 * Connects to a postal instance running inside a dedicated Worker.
 *
 * Called from the **main thread**. The worker must call
 * `connectToHost()` to complete the handshake.
 *
 * @param worker - The Worker instance
 * @param options - Timeout settings (targetOrigin not applicable for workers)
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if the worker doesn't ACK in time
 */
export const connectToWorker = (
    worker: Worker,
    options: Pick<ConnectOptions, "timeout"> = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    return new Promise<Transport>((resolve, reject) => {
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

        worker.postMessage(createSyn(), [port2]);
    });
};

/**
 * Listens for a postal handshake initiated by the host thread.
 *
 * Called from **inside the Worker**. Waits for a SYN with a
 * transferred MessagePort, sends ACK back through it,
 * and resolves with a Transport wrapping the port.
 *
 * @param options - Timeout settings
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if no SYN arrives in time
 */
export const connectToHost = (
    options: Pick<ConnectOptions, "timeout"> = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            globalThis.removeEventListener("message", onSyn);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onSyn = (event: MessageEvent): void => {
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
