export default {};

import type { Envelope } from "postal";
import {
    PROTOCOL_VERSION,
    isUdsSyn,
    isUdsAck,
    isUdsEnvelopeMessage,
    looksLikeSyn,
    looksLikeAck,
    createUdsSyn,
    createUdsAck,
    createUdsEnvelopeMessage,
} from "./protocol";

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-1985",
    type: "publish",
    channel: "timeline",
    topic: "delorean.ready",
    payload: { speed: 88 },
    timestamp: 1234567890,
    ...overrides,
});

describe("protocol", () => {
    describe("createUdsSyn", () => {
        it("should produce a valid SYN message", () => {
            expect(createUdsSyn()).toEqual({
                type: "postal:uds-syn",
                version: PROTOCOL_VERSION,
            });
        });
    });

    describe("createUdsAck", () => {
        it("should produce a valid ACK message", () => {
            expect(createUdsAck()).toEqual({
                type: "postal:uds-ack",
                version: PROTOCOL_VERSION,
            });
        });
    });

    describe("createUdsEnvelopeMessage", () => {
        it("should wrap an envelope in a protocol message", () => {
            const envelope = makeEnvelope({ topic: "flux.capacitor.charged" });
            expect(createUdsEnvelopeMessage(envelope)).toEqual({
                type: "postal:envelope",
                version: PROTOCOL_VERSION,
                envelope,
            });
        });
    });

    describe("isUdsSyn", () => {
        it("should return true for a valid SYN", () => {
            expect(isUdsSyn(createUdsSyn())).toBe(true);
        });

        it("should reject an ACK", () => {
            expect(isUdsSyn(createUdsAck())).toBe(false);
        });

        it("should reject null", () => {
            expect(isUdsSyn(null)).toBe(false);
        });

        it("should reject a string", () => {
            expect(isUdsSyn("postal:uds-syn")).toBe(false);
        });

        it("should reject an object missing the type field", () => {
            expect(isUdsSyn({ version: 1 })).toBe(false);
        });

        it("should reject a non-postal namespace", () => {
            expect(isUdsSyn({ type: "other:syn" })).toBe(false);
        });
    });

    describe("isUdsAck", () => {
        it("should return true for a valid ACK", () => {
            expect(isUdsAck(createUdsAck())).toBe(true);
        });

        it("should reject a SYN", () => {
            expect(isUdsAck(createUdsSyn())).toBe(false);
        });

        it("should reject null", () => {
            expect(isUdsAck(null)).toBe(false);
        });

        it("should reject undefined", () => {
            expect(isUdsAck(undefined)).toBe(false);
        });

        it("should reject a number", () => {
            expect(isUdsAck(42)).toBe(false);
        });
    });

    describe("isUdsSyn — version mismatch", () => {
        it("should reject a SYN with the wrong version", () => {
            expect(isUdsSyn({ type: "postal:uds-syn", version: 999 })).toBe(false);
        });

        it("should reject a SYN with version 0", () => {
            expect(isUdsSyn({ type: "postal:uds-syn", version: 0 })).toBe(false);
        });
    });

    describe("isUdsSyn — additional rejections", () => {
        it("should reject undefined", () => {
            expect(isUdsSyn(undefined)).toBe(false);
        });

        it("should reject a number", () => {
            expect(isUdsSyn(42)).toBe(false);
        });

        it("should reject an array", () => {
            expect(isUdsSyn([1, 2, 3])).toBe(false);
        });

        it("should reject an object with a non-string type field", () => {
            expect(isUdsSyn({ type: 123 })).toBe(false);
        });

        it("should reject the ACK type (wrong postal:uds- suffix)", () => {
            expect(isUdsSyn({ type: "postal:uds-ack", version: 1 })).toBe(false);
        });
    });

    describe("isUdsAck — version mismatch", () => {
        it("should reject an ACK with the wrong version", () => {
            expect(isUdsAck({ type: "postal:uds-ack", version: 999 })).toBe(false);
        });

        it("should reject an ACK with version 0", () => {
            expect(isUdsAck({ type: "postal:uds-ack", version: 0 })).toBe(false);
        });
    });

    describe("isUdsAck — additional rejections", () => {
        it("should reject an array", () => {
            expect(isUdsAck([1, 2, 3])).toBe(false);
        });

        it("should reject a string", () => {
            expect(isUdsAck("postal:uds-ack")).toBe(false);
        });

        it("should reject an object with missing type field", () => {
            expect(isUdsAck({ version: 1 })).toBe(false);
        });

        it("should reject an object with a non-string type field", () => {
            expect(isUdsAck({ type: 999 })).toBe(false);
        });

        it("should reject wrong postal prefix", () => {
            expect(isUdsAck({ type: "other:uds-ack" })).toBe(false);
        });
    });

    describe("isUdsEnvelopeMessage", () => {
        it("should return true for a valid envelope message", () => {
            expect(isUdsEnvelopeMessage(createUdsEnvelopeMessage(makeEnvelope()))).toBe(true);
        });

        it("should reject a SYN", () => {
            expect(isUdsEnvelopeMessage(createUdsSyn())).toBe(false);
        });

        it("should reject an envelope message with missing envelope field", () => {
            expect(isUdsEnvelopeMessage({ type: "postal:envelope", version: 1 })).toBe(false);
        });

        it("should reject an envelope message with null envelope", () => {
            expect(
                isUdsEnvelopeMessage({ type: "postal:envelope", version: 1, envelope: null })
            ).toBe(false);
        });

        it("should reject non-objects", () => {
            expect(isUdsEnvelopeMessage("nope")).toBe(false);
            expect(isUdsEnvelopeMessage(undefined)).toBe(false);
        });

        it("should reject an array", () => {
            expect(isUdsEnvelopeMessage([1, 2, 3])).toBe(false);
        });

        it("should reject an envelope with a non-object envelope field", () => {
            expect(
                isUdsEnvelopeMessage({ type: "postal:envelope", version: 1, envelope: "not-obj" })
            ).toBe(false);
        });

        it("should reject an envelope message with wrong version", () => {
            expect(
                isUdsEnvelopeMessage({
                    type: "postal:envelope",
                    version: 999,
                    envelope: makeEnvelope(),
                })
            ).toBe(false);
        });

        it("should reject an envelope message with version 0", () => {
            expect(
                isUdsEnvelopeMessage({
                    type: "postal:envelope",
                    version: 0,
                    envelope: makeEnvelope(),
                })
            ).toBe(false);
        });
    });

    describe("looksLikeSyn", () => {
        it("should return true for a SYN with the correct version", () => {
            expect(looksLikeSyn(createUdsSyn())).toBe(true);
        });

        it("should return true for a SYN with a wrong version", () => {
            expect(looksLikeSyn({ type: "postal:uds-syn", version: 999 })).toBe(true);
        });

        it("should reject non-SYN messages", () => {
            expect(looksLikeSyn(createUdsAck())).toBe(false);
            expect(looksLikeSyn(null)).toBe(false);
            expect(looksLikeSyn({ type: "other:syn" })).toBe(false);
        });
    });

    describe("looksLikeAck", () => {
        it("should return true for an ACK with the correct version", () => {
            expect(looksLikeAck(createUdsAck())).toBe(true);
        });

        it("should return true for an ACK with a wrong version", () => {
            expect(looksLikeAck({ type: "postal:uds-ack", version: 999 })).toBe(true);
        });

        it("should reject non-ACK messages", () => {
            expect(looksLikeAck(createUdsSyn())).toBe(false);
            expect(looksLikeAck(null)).toBe(false);
            expect(looksLikeAck({ type: "other:ack" })).toBe(false);
        });
    });
});
