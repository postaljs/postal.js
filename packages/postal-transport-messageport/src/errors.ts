/** Thrown when the handshake times out waiting for acknowledgment. */
export class PostalHandshakeTimeoutError extends Error {
    readonly timeout: number;

    constructor(timeout: number) {
        super(`Postal handshake timed out after ${timeout}ms`);
        this.name = "PostalHandshakeTimeoutError";
        this.timeout = timeout;
    }
}
