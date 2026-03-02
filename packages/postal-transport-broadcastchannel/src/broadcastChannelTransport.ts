/**
 * Transport backed by a BroadcastChannel.
 *
 * Bridges postal pub/sub across same-origin tabs and windows.
 * No handshake needed — any context that opens the same-named channel
 * is immediately in the mesh.
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isEnvelopeMessage, createEnvelopeMessage } from "./protocol";

const DEFAULT_CHANNEL_NAME = "postal";

/**
 * Creates a Transport that uses the BroadcastChannel API.
 *
 * @param name - BroadcastChannel name. Defaults to "postal". Use a custom
 *   name to isolate different postal bus instances sharing the same origin.
 * @returns A Transport suitable for postal's addTransport()
 */
export const createBroadcastChannelTransport = (name: string = DEFAULT_CHANNEL_NAME): Transport => {
    let disposed = false;
    const listeners: ((envelope: Envelope) => void)[] = [];
    const channel = new BroadcastChannel(name);

    const onMessage = (event: MessageEvent): void => {
        if (disposed) {
            return;
        }

        if (isEnvelopeMessage(event.data)) {
            const { envelope } = event.data;
            // Snapshot — safe if a listener unsubscribes during iteration
            for (const listener of [...listeners]) {
                try {
                    listener(envelope);
                } catch (err) {
                    // Re-throw asynchronously so a single bad listener doesn't
                    // kill delivery to the rest. Matches browser event dispatch
                    // semantics — each listener error is independent.
                    queueMicrotask(() => {
                        throw err;
                    });
                }
            }
        }
    };

    channel.addEventListener("message", onMessage);

    const send = (envelope: Envelope): void => {
        if (disposed) {
            return;
        }
        channel.postMessage(createEnvelopeMessage(envelope));
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
        channel.removeEventListener("message", onMessage);
        listeners.splice(0, listeners.length);
        channel.close();
    };

    return { send, subscribe, dispose };
};
