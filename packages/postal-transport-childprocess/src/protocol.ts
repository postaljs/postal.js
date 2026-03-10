/**
 * Postal IPC handshake protocol.
 *
 * Namespaced to "postal:" to avoid collisions with other IPC traffic
 * sharing the same child_process or cluster IPC channel.
 *
 * Sequence:
 *   1. Parent sends { type: "postal:syn" } via child.send()
 *   2. Child receives SYN on process.on('message'), sends { type: "postal:ack" }
 *   3. Parent receives ACK, both sides resolve Promise<Transport>
 *   4. Both sides wrap their IPC endpoint in createIPCTransport()
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
    version: number;
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
        "envelope" in data &&
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
    version: PROTOCOL_VERSION,
    envelope,
});
