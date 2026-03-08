export default {};

import { PROTOCOL_VERSION, createEnvelopeMessage, isEnvelopeMessage } from "./protocol";
import type { Envelope } from "postal";

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-NCC-74656",
    type: "publish",
    channel: "voyager",
    topic: "warp.core.breach",
    payload: { containment: false },
    timestamp: 1701000000000,
    ...overrides,
});

describe("protocol", () => {
    describe("createEnvelopeMessage", () => {
        describe("when given a valid envelope without sourceClientId", () => {
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

            it("should not include sourceClientId", () => {
                expect(result.sourceClientId).toBeUndefined();
            });
        });

        describe("when given a valid envelope with sourceClientId", () => {
            let result: ReturnType<typeof createEnvelopeMessage>;

            beforeEach(() => {
                result = createEnvelopeMessage(makeEnvelope(), "client-seven-of-nine");
            });

            it("should include the sourceClientId", () => {
                expect(result.sourceClientId).toBe("client-seven-of-nine");
            });

            it("should still set type to 'postal:envelope'", () => {
                expect(result.type).toBe("postal:envelope");
            });
        });
    });

    describe("isEnvelopeMessage", () => {
        describe("when given a valid envelope message without sourceClientId", () => {
            let result: boolean;

            beforeEach(() => {
                const msg = createEnvelopeMessage(makeEnvelope());
                result = isEnvelopeMessage(msg);
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when given a valid envelope message with sourceClientId", () => {
            let result: boolean;

            beforeEach(() => {
                const msg = createEnvelopeMessage(makeEnvelope(), "client-b5");
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
                result = isEnvelopeMessage("this-is-not-an-envelope");
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

describe("createEnvelopeMessage — sourceClientId branch", () => {
    describe("when sourceClientId is explicitly passed as undefined", () => {
        let result: ReturnType<typeof createEnvelopeMessage>;

        beforeEach(() => {
            result = createEnvelopeMessage(makeEnvelope(), undefined);
        });

        it("should not include the sourceClientId key on the message", () => {
            expect(Object.prototype.hasOwnProperty.call(result, "sourceClientId")).toBe(false);
        });
    });
});

describe("isEnvelopeMessage — additional type checks", () => {
    describe("when given an array", () => {
        it("should return false", () => {
            expect(isEnvelopeMessage([])).toBe(false);
        });
    });

    describe("when given an object with type postal:envelope but envelope is an empty object", () => {
        it("should return true because an empty object is a non-null object", () => {
            expect(isEnvelopeMessage({ type: "postal:envelope", envelope: {} })).toBe(true);
        });
    });
});
