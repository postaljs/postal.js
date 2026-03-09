/**
 * Client-side (tab) transport for the ServiceWorker postal bridge.
 *
 * Establishes a dedicated MessagePort to the active ServiceWorker via a
 * syn/ack handshake. The resulting transport is point-to-point between
 * this tab and the SW — no fan-out, no echo problem.
 *
 * @module
 */

import { addTransport } from "postal";
import { createMessagePortTransport } from "postal-transport-messageport";
import { DEFAULT_TIMEOUT, createSwSyn, isSwAck } from "./protocol";
import { PostalSwHandshakeTimeoutError, PostalSwNotActiveError } from "./errors";
import type { ClientConnectOptions } from "./types";

/**
 * Connects the local postal instance to the active ServiceWorker.
 *
 * Creates a MessageChannel, sends a syn to the SW with port2 transferred,
 * awaits the ack on port1, then wraps port1 in a MessagePort transport
 * and registers it with postal via addTransport().
 *
 * @param registration - The ServiceWorkerRegistration to connect to
 * @param options - Timeout and lifecycle options
 * @returns Promise resolving with the remove function from addTransport()
 * @throws PostalSwNotActiveError if registration.active is null
 * @throws PostalSwHandshakeTimeoutError if the SW doesn't ack in time
 */
export const connectToServiceWorker = (
    registration: ServiceWorkerRegistration,
    options: ClientConnectOptions = {}
): Promise<() => void> => {
    const { timeout = DEFAULT_TIMEOUT, onDisconnect } = options;

    if (!registration.active) {
        return Promise.reject(new PostalSwNotActiveError());
    }

    return new Promise<() => void>((resolve, reject) => {
        const channel = new MessageChannel();
        const { port1, port2 } = channel;

        const timer = setTimeout(() => {
            port1.removeEventListener("message", onAck);
            port1.close();
            reject(new PostalSwHandshakeTimeoutError(timeout));
        }, timeout);

        const onAck = (event: MessageEvent): void => {
            if (isSwAck(event.data)) {
                clearTimeout(timer);
                port1.removeEventListener("message", onAck);

                const transport = createMessagePortTransport(port1);
                const removeTransport = addTransport(transport);

                // When the SW is replaced (update/restart), notify the consumer
                // so they can decide whether to reconnect. The old MessagePort is
                // dead at this point — sending on it silently drops messages.
                if (onDisconnect && typeof navigator !== "undefined" && navigator.serviceWorker) {
                    const onControllerChange = (): void => {
                        navigator.serviceWorker.removeEventListener(
                            "controllerchange",
                            onControllerChange
                        );
                        onDisconnect();
                    };
                    navigator.serviceWorker.addEventListener(
                        "controllerchange",
                        onControllerChange
                    );

                    // Wrap removeTransport so that an early consumer-side disconnect
                    // also removes the controllerchange listener. Without this, a
                    // connect/disconnect cycle in a long-lived SPA accumulates listeners
                    // that never fire and are never collected.
                    resolve(() => {
                        navigator.serviceWorker.removeEventListener(
                            "controllerchange",
                            onControllerChange
                        );
                        removeTransport();
                    });
                } else {
                    resolve(removeTransport);
                }
            }
        };

        port1.addEventListener("message", onAck);
        port1.start();

        // non-null assertion is safe — we checked above and the function is synchronous
        // to this point (no awaits between the null check and the postMessage call)
        registration.active!.postMessage(createSwSyn(), [port2]);
    });
};
