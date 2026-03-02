/**
 * Low-level Transport backed by a raw MessagePort.
 *
 * Every high-level wrapper (iframe, worker) ultimately delegates
 * to this after the handshake completes.
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isEnvelopeMessage, createEnvelopeMessage } from "./protocol";

/**
 * Creates a Transport from a connected MessagePort.
 *
 * The port must already be connected (postMessage works). For ports
 * from a MessageChannel, call port.start() first — though this
 * function calls it defensively since start() is idempotent.
 *
 * @param port - A connected MessagePort instance
 * @returns A Transport suitable for postal's addTransport()
 */
export const createMessagePortTransport = (port: MessagePort): Transport => {
    let disposed = false;
    const listeners: ((envelope: Envelope) => void)[] = [];

    const onMessage = (event: MessageEvent): void => {
        if (disposed) {
            return;
        }

        if (isEnvelopeMessage(event.data)) {
            const { envelope } = event.data;
            // Snapshot — safe if a listener unsubscribes during iteration
            for (const listener of [...listeners]) {
                listener(envelope);
            }
        }
    };

    port.addEventListener("message", onMessage);
    port.start();

    const send = (envelope: Envelope): void => {
        if (disposed) {
            return;
        }
        port.postMessage(createEnvelopeMessage(envelope));
    };

    const subscribe = (callback: (envelope: Envelope) => void): (() => void) => {
        listeners.push(callback);

        let removed = false;
        return () => {
            if (removed) {
                return;
            }
            removed = true;
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        };
    };

    const dispose = (): void => {
        if (disposed) {
            return;
        }
        disposed = true;
        port.removeEventListener("message", onMessage);
        listeners.splice(0, listeners.length);
        port.close();
    };

    return { send, subscribe, dispose };
};
