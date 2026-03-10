/** Options for high-level IPC connection helpers. */
export type ConnectOptions = {
    /**
     * Timeout in milliseconds for the handshake to complete.
     * Rejects with PostalHandshakeTimeoutError if exceeded.
     * @default 5000
     */
    timeout?: number;
};
