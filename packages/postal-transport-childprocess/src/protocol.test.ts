export default {};

import {
    PROTOCOL_VERSION,
    isSyn,
    isAck,
    isEnvelopeMessage,
    createSyn,
    createAck,
    createEnvelopeMessage,
} from "./protocol";
import type { Envelope } from "postal";

// --- Test helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-42",
    type: "publish",
    channel: "flux",
    topic: "capacitor.charged",
    payload: { jiggowatts: 1.21 },
    timestamp: 1234567890,
    ...overrides,
});

describe("protocol", () => {
    describe("isSyn", () => {
        describe("when the message is a valid postal:syn", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn({ type: "postal:syn", version: PROTOCOL_VERSION });
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when the message type is postal:ack", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn({ type: "postal:ack", version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message type is postal:envelope", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn({ type: "postal:envelope", version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is not an object", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn("postal:syn");
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is missing the type field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn({ version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the type field is not a postal namespaced string", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSyn({ type: "syn", version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });

    describe("isAck", () => {
        describe("when the message is a valid postal:ack", () => {
            let result: boolean;

            beforeEach(() => {
                result = isAck({ type: "postal:ack", version: PROTOCOL_VERSION });
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when the message type is postal:syn", () => {
            let result: boolean;

            beforeEach(() => {
                result = isAck({ type: "postal:syn", version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isAck(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is not an object", () => {
            let result: boolean;

            beforeEach(() => {
                result = isAck(42);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is missing the type field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isAck({ version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });

    describe("isEnvelopeMessage", () => {
        describe("when the message is a valid postal:envelope", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({
                    type: "postal:envelope",
                    version: PROTOCOL_VERSION,
                    envelope: makeEnvelope(),
                });
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when the envelope field is missing", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ type: "postal:envelope", version: PROTOCOL_VERSION });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the envelope field is null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({
                    type: "postal:envelope",
                    version: PROTOCOL_VERSION,
                    envelope: null,
                });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the type is postal:syn instead of postal:envelope", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({
                    type: "postal:syn",
                    version: PROTOCOL_VERSION,
                    envelope: makeEnvelope(),
                });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message is a plain string", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage("postal:envelope");
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when the message has garbage fields", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ garbage: true, noise: "yes" });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });

    describe("createSyn", () => {
        let result: ReturnType<typeof createSyn>;

        beforeEach(() => {
            result = createSyn();
        });

        it("should produce a message with type postal:syn", () => {
            expect(result.type).toBe("postal:syn");
        });

        it("should stamp the current protocol version", () => {
            expect(result.version).toBe(PROTOCOL_VERSION);
        });
    });

    describe("createAck", () => {
        let result: ReturnType<typeof createAck>;

        beforeEach(() => {
            result = createAck();
        });

        it("should produce a message with type postal:ack", () => {
            expect(result.type).toBe("postal:ack");
        });

        it("should stamp the current protocol version", () => {
            expect(result.version).toBe(PROTOCOL_VERSION);
        });
    });

    describe("createEnvelopeMessage", () => {
        let envelope: Envelope, result: ReturnType<typeof createEnvelopeMessage>;

        beforeEach(() => {
            envelope = makeEnvelope({ topic: "delorean.ready" });
            result = createEnvelopeMessage(envelope);
        });

        it("should produce a message with type postal:envelope", () => {
            expect(result.type).toBe("postal:envelope");
        });

        it("should stamp the current protocol version", () => {
            expect(result.version).toBe(PROTOCOL_VERSION);
        });

        it("should embed the envelope verbatim", () => {
            expect(result.envelope).toBe(envelope);
        });
    });
});
