/**
 * Configuration types for UDS transport server and client.
 *
 * @module
 */

import type { TransportFilter } from "postal";
export type { Serializer } from "./serialization";

/** Options for the UDS server (listenOnSocket). */
export type UdsServerOptions = {
    /** Optional filter restricting which envelopes this transport forwards. */
    filter?: TransportFilter;
    /**
     * Attempt to unlink a stale socket file before listening.
     * @default true
     */
    unlinkStale?: boolean;
    /**
     * Handshake timeout in milliseconds per connecting client.
     * Clients that don't send a SYN within this window are disconnected.
     * @default 5000
     */
    timeout?: number;
};

/** Options for the UDS client (connectToSocket). */
export type UdsConnectOptions = {
    /**
     * Timeout in milliseconds for the handshake to complete.
     * Rejects with PostalUdsHandshakeTimeoutError if exceeded.
     * @default 5000
     */
    timeout?: number;
    /**
     * Called when the socket connection drops unexpectedly (server goes away,
     * network error, etc). NOT called when the consumer explicitly disconnects
     * by invoking the returned cleanup function. Auto-reconnection is not
     * provided — implement retry logic in this callback if needed.
     */
    onDisconnect?: () => void;
};
