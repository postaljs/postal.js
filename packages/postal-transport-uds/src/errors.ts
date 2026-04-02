/**
 * Thrown when the UDS handshake does not complete within the configured timeout.
 *
 * On the client side, this means the server did not respond with an ACK.
 * On the server side, this means a connecting client did not send a SYN.
 * In either case, the socket is destroyed before the error is thrown.
 *
 * The {@link timeout} property preserves the configured value for diagnostics.
 */
export class PostalUdsHandshakeTimeoutError extends Error {
    /** The timeout duration (ms) that was exceeded. */
    readonly timeout: number;

    constructor(timeout: number) {
        super(`Postal UDS handshake timed out after ${timeout}ms`);
        this.name = "PostalUdsHandshakeTimeoutError";
        this.timeout = timeout;
    }
}

/**
 * Thrown when a SYN or ACK arrives with a protocol version that doesn't
 * match the local PROTOCOL_VERSION. This is a clear signal that the
 * remote side needs to be updated — not a transient network issue.
 */
export class PostalUdsVersionMismatchError extends Error {
    /** The version received from the remote side. */
    readonly received: number;
    /** The version this side expected (i.e. PROTOCOL_VERSION). */
    readonly expected: number;

    constructor(received: number, expected: number) {
        super(`Postal UDS protocol version mismatch: received ${received}, expected ${expected}`);
        this.name = "PostalUdsVersionMismatchError";
        this.received = received;
        this.expected = expected;
    }
}
