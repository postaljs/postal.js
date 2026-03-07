/**
 * Low-level Transport backed by a Node.js IPC endpoint.
 *
 * Works with any object that satisfies the IPCEndpoint shape:
 * child_process.ChildProcess, cluster.Worker, or process (with IPC).
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isEnvelopeMessage, createEnvelopeMessage } from "./protocol";

/**
 * The minimal surface shared by child_process.ChildProcess, cluster.Worker,
 * and process (when running with IPC). Typed loosely so callers can pass
 * concrete Node types without needing this package to import @types/node.
 */
export type IPCEndpoint = {
    // Typed as void rather than boolean — ChildProcess.send() and cluster.Worker.send()
    // both return boolean for backpressure signaling, but postal's Transport interface
    // does not expose backpressure. The return value is intentionally dropped here.
    send(message: unknown): void;
    on(event: "message", handler: (message: unknown) => void): void;
    removeListener(event: "message", handler: (message: unknown) => void): void;
};

/**
 * Creates a Transport from an IPC endpoint.
 *
 * Disposal stops postal message delivery but does NOT kill or disconnect
 * the underlying process — the caller owns the process lifecycle.
 *
 * @param endpoint - An IPC-capable Node.js object
 * @returns A Transport suitable for postal's addTransport()
 */
export const createIPCTransport = (endpoint: IPCEndpoint): Transport => {
    let disposed = false;
    const listeners: ((envelope: Envelope) => void)[] = [];

    const onMessage = (message: unknown): void => {
        if (disposed) {
            return;
        }

        if (isEnvelopeMessage(message)) {
            const { envelope } = message;
            // Snapshot — safe if a listener unsubscribes during iteration
            for (const listener of [...listeners]) {
                try {
                    listener(envelope);
                } catch (err) {
                    // Re-throw asynchronously so a single bad listener doesn't
                    // kill delivery to the rest.
                    queueMicrotask(() => {
                        throw err;
                    });
                }
            }
        }
    };

    endpoint.on("message", onMessage);

    const send = (envelope: Envelope): void => {
        if (disposed) {
            return;
        }
        endpoint.send(createEnvelopeMessage(envelope));
    };

    const subscribe = (callback: (envelope: Envelope) => void): (() => void) => {
        // Reject subscriptions on a disposed transport — nothing will ever arrive.
        if (disposed) {
            return () => {};
        }

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
        endpoint.removeListener("message", onMessage);
        listeners.splice(0, listeners.length);
        // Intentionally NOT calling endpoint.kill() or endpoint.disconnect().
        // The transport is a consumer of the IPC channel, not its owner.
    };

    return { send, subscribe, dispose };
};
