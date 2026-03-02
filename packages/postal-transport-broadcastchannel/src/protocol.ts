/**
 * Postal BroadcastChannel protocol.
 *
 * Namespaced to "postal:" to avoid collisions with other messages
 * that may share the same BroadcastChannel name. Unlike the MessagePort
 * transport there is no handshake — BroadcastChannel is inherently pub/sub,
 * so any tab that opens the same-named channel is immediately in the mesh.
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

export const createEnvelopeMessage = (envelope: Envelope): EnvelopeMessage => ({
    type: "postal:envelope",
    version: PROTOCOL_VERSION,
    envelope,
});
