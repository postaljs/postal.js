export default {};

import { PROTOCOL_VERSION, createEnvelopeMessage, isEnvelopeMessage } from "./protocol";
import type { Envelope } from "postal";

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-1701",
    type: "publish",
    channel: "bridge",
    topic: "warp.engaged",
    payload: { speed: 9 },
    timestamp: 1701000000000,
    ...overrides,
});

describe("protocol", () => {
    describe("createEnvelopeMessage", () => {
        describe("when given a valid envelope", () => {
            let envelope: Envelope;
            let result: ReturnType<typeof createEnvelopeMessage>;

            beforeEach(() => {
                envelope = makeEnvelope();
                result = createEnvelopeMessage(envelope);
            });

            it("should set type to 'postal:envelope'", () => {
                expect(result.type).toBe("postal:envelope");
            });

            it("should set version to PROTOCOL_VERSION", () => {
                expect(result.version).toBe(PROTOCOL_VERSION);
            });

            it("should include the original envelope unchanged", () => {
                expect(result.envelope).toEqual(envelope);
            });
        });
    });

    describe("isEnvelopeMessage", () => {
        describe("when given a valid envelope message", () => {
            let result: boolean;

            beforeEach(() => {
                const msg = createEnvelopeMessage(makeEnvelope());
                result = isEnvelopeMessage(msg);
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when given null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given a non-object primitive", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage("totally-not-an-envelope");
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object with the wrong type string", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ type: "postal:syn", envelope: makeEnvelope() });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object missing the type field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ envelope: makeEnvelope() });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object missing the envelope field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ type: "postal:envelope" });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object with a null envelope field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ type: "postal:envelope", envelope: null });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object with a non-object envelope field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isEnvelopeMessage({ type: "postal:envelope", envelope: 42 });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });
});
