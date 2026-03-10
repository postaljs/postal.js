export default {};

import { PROTOCOL_VERSION, createSwSyn, createSwAck, isSwSyn, isSwAck } from "./protocol";

describe("protocol", () => {
    describe("createSwSyn", () => {
        describe("when called", () => {
            let result: ReturnType<typeof createSwSyn>;

            beforeEach(() => {
                result = createSwSyn();
            });

            it("should set type to 'postal:sw-syn'", () => {
                expect(result.type).toBe("postal:sw-syn");
            });

            it("should set version to PROTOCOL_VERSION", () => {
                expect(result.version).toBe(PROTOCOL_VERSION);
            });
        });
    });

    describe("createSwAck", () => {
        describe("when called", () => {
            let result: ReturnType<typeof createSwAck>;

            beforeEach(() => {
                result = createSwAck();
            });

            it("should set type to 'postal:sw-ack'", () => {
                expect(result.type).toBe("postal:sw-ack");
            });

            it("should set version to PROTOCOL_VERSION", () => {
                expect(result.version).toBe(PROTOCOL_VERSION);
            });
        });
    });

    describe("isSwSyn", () => {
        describe("when given a valid sw-syn message", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn(createSwSyn());
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when given a sw-ack message", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn(createSwAck());
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given a generic postal syn (different namespace)", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn({ type: "postal:syn", version: 1 });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given a non-object primitive", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn("postal:sw-syn");
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an object with a non-string type field", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwSyn({ type: 42 });
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });

    describe("isSwAck", () => {
        describe("when given a valid sw-ack message", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwAck(createSwAck());
            });

            it("should return true", () => {
                expect(result).toBe(true);
            });
        });

        describe("when given a sw-syn message", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwAck(createSwSyn());
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given null", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwAck(null);
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });

        describe("when given an empty object", () => {
            let result: boolean;

            beforeEach(() => {
                result = isSwAck({});
            });

            it("should return false", () => {
                expect(result).toBe(false);
            });
        });
    });
});
