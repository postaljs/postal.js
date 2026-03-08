/**
 * Thrown when the ServiceWorker transport cannot establish a connection.
 * Common causes:
 *   - navigator.serviceWorker is unavailable (non-HTTPS or unsupported browser)
 *   - No SW controller appeared within the timeout (SW not calling clients.claim())
 */
export class PostalServiceWorkerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PostalServiceWorkerError";
    }
}
