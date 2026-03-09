import type { TransportFilter } from "postal";

/** Options for connectToServiceWorker(). */
export type ClientConnectOptions = {
    /**
     * Timeout in milliseconds for the handshake to complete.
     * Rejects with PostalSwHandshakeTimeoutError if exceeded.
     * @default 5000
     */
    timeout?: number;

    /**
     * Called when the ServiceWorker is replaced (controllerchange event).
     * The existing MessagePort transport is dead at this point — reconnect
     * manually or call connectToServiceWorker() again.
     */
    onDisconnect?: () => void;
};

/** Options for listenForClients(). */
export type SwListenOptions = {
    /**
     * Optional filter applied to each client transport as it connects.
     * Restricts which envelopes are forwarded to/from connected clients.
     */
    filter?: TransportFilter;
};
