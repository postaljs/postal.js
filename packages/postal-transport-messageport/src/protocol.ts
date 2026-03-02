/**
 * Postal MessagePort handshake protocol.
 *
 * Namespaced to "postal:" to avoid collisions with other postMessage
 * traffic sharing the same window or worker global scope.
 *
 * Sequence:
 *   1. Initiator creates a MessageChannel
 *   2. Initiator sends { type: "postal:syn" } via postMessage,
 *      transferring port2
 *   3. Receiver gets port2, sends { type: "postal:ack" } through it
 *   4. Initiator receives ack on port1, resolves Promise<Transport>
 *   5. Both sides wrap their port in createMessagePortTransport()
 *
 * @module
 */

import type { Envelope } from "postal";

/** Protocol version — bump if the handshake format changes. */
export const PROTOCOL_VERSION = 1;

/** Default handshake timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 5000;

const POSTAL_NAMESPACE = "postal:";

// --- Message shapes ---

export type HandshakeMessage = {
    type: "postal:syn" | "postal:ack";
    version: number;
};

export type EnvelopeMessage = {
    type: "postal:envelope";
    envelope: Envelope;
};

export type ProtocolMessage = HandshakeMessage | EnvelopeMessage;

// --- Type guards ---

const isPostalMessage = (data: unknown): data is ProtocolMessage => {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        typeof (data as ProtocolMessage).type === "string" &&
        (data as ProtocolMessage).type.startsWith(POSTAL_NAMESPACE)
    );
};

export const isSyn = (data: unknown): data is HandshakeMessage => {
    return isPostalMessage(data) && (data as HandshakeMessage).type === "postal:syn";
};

export const isAck = (data: unknown): data is HandshakeMessage => {
    return isPostalMessage(data) && (data as HandshakeMessage).type === "postal:ack";
};

export const isEnvelopeMessage = (data: unknown): data is EnvelopeMessage => {
    return (
        isPostalMessage(data) &&
        (data as EnvelopeMessage).type === "postal:envelope" &&
        typeof (data as EnvelopeMessage).envelope === "object" &&
        (data as EnvelopeMessage).envelope !== null
    );
};

// --- Message factories ---

export const createSyn = (): HandshakeMessage => ({
    type: "postal:syn",
    version: PROTOCOL_VERSION,
});

export const createAck = (): HandshakeMessage => ({
    type: "postal:ack",
    version: PROTOCOL_VERSION,
});

export const createEnvelopeMessage = (envelope: Envelope): EnvelopeMessage => ({
    type: "postal:envelope",
    envelope,
});
