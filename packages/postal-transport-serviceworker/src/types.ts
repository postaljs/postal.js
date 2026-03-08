/** Options for createClientTransport(). */
export type ClientTransportOptions = {
    /**
     * Timeout in milliseconds to wait for a SW controller to become available.
     * Rejects with PostalServiceWorkerError if exceeded.
     * @default 5000
     */
    timeout?: number;
};

/** Options for createServiceWorkerTransport(). */
export type ServiceWorkerTransportOptions = {
    /**
     * Controls which clients receive fan-out messages.
     * Maps to clients.matchAll() options.
     * @default { type: "window", includeUncontrolled: false }
     */
    clientMatchOptions?: ClientQueryOptions;
};
