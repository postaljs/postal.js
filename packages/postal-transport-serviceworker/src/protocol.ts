/**
 * Postal ServiceWorker transport wire protocol.
 *
 * Namespaced to "postal:" to avoid collisions with other postMessage traffic.
 * No handshake — the SW messaging channel is implicitly established:
 * clients reach the SW via navigator.serviceWorker.controller, and the SW
 * reaches clients via self.clients.matchAll(). This is closer to
 * BroadcastChannel's pub/sub model than MessagePort's point-to-point model.
 *
 * @module
 */

import type { Envelope } from "postal";

/** Protocol version — bump if the wire format changes. */
export const PROTOCOL_VERSION = 1;

// --- Message shape ---

export type EnvelopeMessage = {
    type: "postal:envelope";
    version: number;
    envelope: Envelope;
    /**
     * Set by the SW when fanning out to other clients, so the originating
     * client can be excluded from receiving its own messages back.
     */
    sourceClientId?: string;
};

// --- Type guard ---

export const isEnvelopeMessage = (data: unknown): data is EnvelopeMessage => {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        (data as EnvelopeMessage).type === "postal:envelope" &&
        "envelope" in data &&
        typeof (data as EnvelopeMessage).envelope === "object" &&
        (data as EnvelopeMessage).envelope !== null
    );
};

// --- Message factory ---

export const createEnvelopeMessage = (
    envelope: Envelope,
    sourceClientId?: string
): EnvelopeMessage => ({
    type: "postal:envelope",
    version: PROTOCOL_VERSION,
    envelope,
    ...(sourceClientId !== undefined ? { sourceClientId } : {}),
});
