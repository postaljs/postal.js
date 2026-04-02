/**
 * Postal UDS handshake protocol.
 *
 * Namespaced to "postal:uds-" for handshake messages to avoid collisions
 * with other transport types sharing a process. Envelope messages use
 * the shared "postal:envelope" type.
 *
 * Sequence:
 *   1. Client connects to socket, sends { type: "postal:uds-syn" }
 *   2. Server receives SYN, responds with { type: "postal:uds-ack" }
 *   3. Both sides wrap the socket in createSocketTransport()
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

/** Client-to-server handshake initiation. */
export type UdsSynMessage = {
    type: "postal:uds-syn";
    version: number;
};

/** Server-to-client handshake acknowledgment. */
export type UdsAckMessage = {
    type: "postal:uds-ack";
    version: number;
};

/** Wraps a postal Envelope for transmission over the socket. */
export type UdsEnvelopeMessage = {
    type: "postal:envelope";
    version: number;
    envelope: Envelope;
};

/** Union of all messages that can appear on the wire. */
export type UdsProtocolMessage = UdsSynMessage | UdsAckMessage | UdsEnvelopeMessage;

// --- Type guards ---
// Three-step validation: check it's an object, has a string `type` field,
// and the type starts with the postal namespace. This rejects nulls, arrays,
// primitives, and non-postal traffic without throwing.

const isPostalMessage = (data: unknown): data is UdsProtocolMessage => {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        typeof (data as UdsProtocolMessage).type === "string" &&
        (data as UdsProtocolMessage).type.startsWith(POSTAL_NAMESPACE)
    );
};

/** Narrows unknown data to a SYN message. Safe to call on any input. */
export const isUdsSyn = (data: unknown): data is UdsSynMessage => {
    return (
        isPostalMessage(data) &&
        (data as UdsSynMessage).type === "postal:uds-syn" &&
        (data as UdsSynMessage).version === PROTOCOL_VERSION
    );
};

/** Narrows unknown data to an ACK message. Safe to call on any input. */
export const isUdsAck = (data: unknown): data is UdsAckMessage => {
    return (
        isPostalMessage(data) &&
        (data as UdsAckMessage).type === "postal:uds-ack" &&
        (data as UdsAckMessage).version === PROTOCOL_VERSION
    );
};

/**
 * Loose check — matches the SYN type string without version validation.
 * Used to distinguish "wrong version" from "not a SYN at all".
 */
export const looksLikeSyn = (data: unknown): data is UdsSynMessage => {
    return isPostalMessage(data) && (data as UdsSynMessage).type === "postal:uds-syn";
};

/**
 * Loose check — matches the ACK type string without version validation.
 * Used to distinguish "wrong version" from "not an ACK at all".
 */
export const looksLikeAck = (data: unknown): data is UdsAckMessage => {
    return isPostalMessage(data) && (data as UdsAckMessage).type === "postal:uds-ack";
};

/** Narrows unknown data to an envelope wrapper. Validates type, version, and that envelope is a non-null object. */
export const isUdsEnvelopeMessage = (data: unknown): data is UdsEnvelopeMessage => {
    return (
        isPostalMessage(data) &&
        (data as UdsEnvelopeMessage).type === "postal:envelope" &&
        (data as UdsEnvelopeMessage).version === PROTOCOL_VERSION &&
        "envelope" in data &&
        typeof (data as UdsEnvelopeMessage).envelope === "object" &&
        (data as UdsEnvelopeMessage).envelope !== null
    );
};

// --- Message factories ---

/** Creates a SYN message stamped with the current protocol version. */
export const createUdsSyn = (): UdsSynMessage => ({
    type: "postal:uds-syn",
    version: PROTOCOL_VERSION,
});

/** Creates an ACK message stamped with the current protocol version. */
export const createUdsAck = (): UdsAckMessage => ({
    type: "postal:uds-ack",
    version: PROTOCOL_VERSION,
});

/** Wraps a postal Envelope in a protocol message for wire transmission. */
export const createUdsEnvelopeMessage = (envelope: Envelope): UdsEnvelopeMessage => ({
    type: "postal:envelope",
    version: PROTOCOL_VERSION,
    envelope,
});
