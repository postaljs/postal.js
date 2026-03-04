/**
 * Types and factory for postal's message envelopes.
 *
 * Every message flowing through postal — publishes, requests, and replies —
 * is wrapped in an envelope that carries routing metadata alongside the payload.
 * @module
 */

/** The kind of message this envelope carries. */
export type EnvelopeType = "publish" | "request" | "reply";

/**
 * Standard message wrapper used internally and exposed to subscribers.
 *
 * Envelopes are the unit of communication in postal. Subscribers receive
 * the full envelope, and transports serialize/deserialize them when
 * bridging across execution boundaries.
 */
export type Envelope<TPayload = unknown> = {
    /** Unique message identifier (UUID v4) */
    id: string;
    /** The kind of message */
    type: EnvelopeType;
    /** The channel this message was published on */
    channel: string;
    /** The dot-delimited topic string */
    topic: string;
    /** The message payload */
    payload: TPayload;
    /** When the envelope was created — Date.now() for serialization safety */
    timestamp: number;
    /** Originating context identifier, set by transports to track message origin */
    source?: string;
    /** Present on 'request' envelopes — the topic to send the reply to */
    replyTo?: string;
    /** Present on 'reply' envelopes — correlates back to the original request */
    correlationId?: string;
};

/** Options for creating a new envelope. ID and timestamp are generated automatically. */
export type CreateEnvelopeOptions<TPayload = unknown> = {
    type: EnvelopeType;
    channel: string;
    topic: string;
    payload: TPayload;
    source?: string;
    replyTo?: string;
    correlationId?: string;
};

/**
 * Creates a new envelope with a unique ID and current timestamp.
 *
 * Optional fields (`source`, `replyTo`, `correlationId`) are only included
 * on the envelope when explicitly provided — they won't appear as `undefined`
 * properties, which keeps serialized output clean.
 *
 * @param options - The envelope fields. `id` and `timestamp` are generated automatically.
 * @returns A fully formed envelope ready for delivery
 */
export const createEnvelope = <TPayload>({
    type,
    channel,
    topic,
    payload,
    source,
    replyTo,
    correlationId,
}: CreateEnvelopeOptions<TPayload>): Envelope<TPayload> => {
    const envelope: Envelope<TPayload> = {
        id: crypto.randomUUID(),
        type,
        channel,
        topic,
        payload,
        timestamp: Date.now(),
    };

    if (source !== undefined) {
        envelope.source = source;
    }
    if (replyTo !== undefined) {
        envelope.replyTo = replyTo;
    }
    if (correlationId !== undefined) {
        envelope.correlationId = correlationId;
    }

    return envelope;
};
