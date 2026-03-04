/** Options for high-level connection wrappers. */
export type ConnectOptions = {
    /**
     * Timeout in milliseconds for the handshake to complete.
     * Rejects with PostalHandshakeTimeoutError if exceeded.
     * @default 5000
     */
    timeout?: number;

    /**
     * Origin passed to postMessage when sending the SYN.
     * Used by `connectToIframe` to restrict which origins can receive the port.
     * Should be set to the iframe's origin in production.
     * @default "*"
     */
    targetOrigin?: string;

    /**
     * Expected origin of the incoming SYN message.
     * Used by `connectToParent` to filter out messages from untrusted origins.
     * Should be set to the parent's origin in production.
     * @default "*" (accept from any origin)
     */
    allowedOrigin?: string;
};
