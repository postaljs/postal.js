/**
 * Service Worker-side transport for the postal ServiceWorker bridge.
 *
 * Runs inside the SW global scope. Receives messages from all connected
 * clients, dispatches them to local postal subscribers, and fans them out
 * to all other clients (excluding the sender).
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isEnvelopeMessage, createEnvelopeMessage } from "./protocol";
import type { ServiceWorkerTransportOptions } from "./types";

const DEFAULT_CLIENT_MATCH_OPTIONS: ClientQueryOptions = {
    type: "window",
    includeUncontrolled: false,
};

/**
 * Creates a Transport that runs inside a ServiceWorker.
 *
 * Fan-out (send) is fire-and-forget async: Transport.send() is synchronous
 * by contract, but clients.matchAll() is async. Messages are delivered on
 * the next microtask tick. This is acceptable because cross-process message
 * delivery is inherently asynchronous anyway.
 */
export const createServiceWorkerTransport = (
    options: ServiceWorkerTransportOptions = {}
): Transport => {
    const clientMatchOptions = options.clientMatchOptions ?? DEFAULT_CLIENT_MATCH_OPTIONS;
    let disposed = false;
    const listeners: ((envelope: Envelope) => void)[] = [];

    const onMessage = (event: ExtendableMessageEvent): void => {
        if (disposed) {
            return;
        }
        if (!isEnvelopeMessage(event.data)) {
            return;
        }

        const { envelope } = event.data;
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
    };

    // Cast needed because SW global `self` is ServiceWorkerGlobalScope, but
    // TypeScript's WebWorker lib types `self` as WorkerGlobalScope. At runtime
    // in an actual SW, addEventListener("message", ...) works as expected.
    (self as unknown as ServiceWorkerGlobalScope).addEventListener("message", onMessage);

    const send = (envelope: Envelope): void => {
        if (disposed) {
            return;
        }

        // Fire-and-forget: matchAll is async, but Transport.send() must be sync.
        // The promise is intentionally not awaited — fan-out happens on the next tick.
        (self as unknown as ServiceWorkerGlobalScope).clients
            .matchAll(clientMatchOptions)
            .then(clients => {
                // Re-check disposed: dispose() may have been called between the
                // synchronous send() entry and this async continuation.
                if (disposed) {
                    return;
                }
                const msg = createEnvelopeMessage(envelope);
                for (const client of clients) {
                    try {
                        client.postMessage(msg);
                    } catch (err) {
                        // A stale or rejected client shouldn't abort delivery
                        // to the remaining clients — surface the error async.
                        queueMicrotask(() => {
                            throw err;
                        });
                    }
                }
            })
            // matchAll rejection is unexpected in a healthy SW environment,
            // but guard against it to avoid unhandled promise rejections.
            .catch((err: unknown) => {
                queueMicrotask(() => {
                    throw err;
                });
            });
    };

    const subscribe = (callback: (envelope: Envelope) => void): (() => void) => {
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
        (self as unknown as ServiceWorkerGlobalScope).removeEventListener("message", onMessage);
        listeners.splice(0, listeners.length);
    };

    return { send, subscribe, dispose };
};
