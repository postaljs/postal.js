/** Thrown when the ServiceWorker handshake does not complete within the timeout. */
export class PostalSwHandshakeTimeoutError extends Error {
    readonly timeout: number;

    constructor(timeout: number) {
        super(`Postal SW handshake timed out after ${timeout}ms`);
        this.name = "PostalSwHandshakeTimeoutError";
        this.timeout = timeout;
    }
}

/**
 * Thrown when connectToServiceWorker() is called but registration.active is null.
 *
 * This happens when the registration exists but the SW has not yet activated —
 * for example, on the very first install before the SW has called clients.claim().
 * The caller should wait for the SW to activate (e.g., listen for controllerchange)
 * and retry.
 */
export class PostalSwNotActiveError extends Error {
    constructor() {
        super(
            "ServiceWorker is not active. registration.active is null. " +
                "Wait for the SW to activate and retry."
        );
        this.name = "PostalSwNotActiveError";
    }
}
