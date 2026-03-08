/**
 * Client-side (page/tab) transport for the ServiceWorker postal bridge.
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isEnvelopeMessage, createEnvelopeMessage } from "./protocol";
import { PostalServiceWorkerError } from "./errors";
import type { ClientTransportOptions } from "./types";

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Returns navigator.serviceWorker, or throws PostalServiceWorkerError if unavailable.
 */
const getContainer = (): ServiceWorkerContainer => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) {
        throw new PostalServiceWorkerError(
            "navigator.serviceWorker is not available. Ensure the page is served over HTTPS."
        );
    }

    return navigator.serviceWorker;
};

/**
 * Waits for navigator.serviceWorker.controller to be available, then returns
 * a postal Transport that routes messages through the Service Worker.
 *
 * Returns a Promise because navigator.serviceWorker.controller may be null on
 * first page load before the SW calls clients.claim(). If no controller appears
 * within the timeout, rejects with PostalServiceWorkerError.
 */
export const createClientTransport = (options: ClientTransportOptions = {}): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT_MS } = options;

    let container: ServiceWorkerContainer;
    try {
        container = getContainer();
    } catch (err) {
        return Promise.reject(err);
    }

    const waitForController = (): Promise<void> => {
        if (container.controller) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            // Guard against the race where both the timer and controllerchange
            // fire in the same turn of the event loop (e.g., in tests with fake
            // timers, or on a heavily loaded page). First one to run wins.
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) {
                    return;
                }
                settled = true;
                container.removeEventListener("controllerchange", onControllerChange);
                reject(
                    new PostalServiceWorkerError(
                        `No ServiceWorker controller appeared within ${timeout}ms. ` +
                            "Ensure the SW calls self.clients.claim() in its activate handler."
                    )
                );
            }, timeout);

            const onControllerChange = (): void => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                container.removeEventListener("controllerchange", onControllerChange);
                resolve();
            };

            container.addEventListener("controllerchange", onControllerChange);
        });
    };

    return waitForController().then((): Transport => {
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

        container.addEventListener("message", onMessage);

        const send = (envelope: Envelope): void => {
            if (disposed) {
                return;
            }
            // Read controller at send time so we pick up any SW updates transparently.
            // Controller can be null between an update and the new SW claiming clients —
            // silently drop in that gap.
            const ctrl = container.controller;
            if (!ctrl) {
                return;
            }
            ctrl.postMessage(createEnvelopeMessage(envelope));
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
            container.removeEventListener("message", onMessage);
            listeners.splice(0, listeners.length);
        };

        return { send, subscribe, dispose };
    });
};
