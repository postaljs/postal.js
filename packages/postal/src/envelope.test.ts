export default {};

import { createEnvelope, type Envelope } from "./envelope";

const FROZEN_TIME = new Date("2026-03-01T12:00:00.000Z").getTime();

describe("envelope", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(FROZEN_TIME);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("createEnvelope", () => {
        describe("when creating an envelope with required fields only", () => {
            let result: Envelope<{ sku: string }>;

            beforeEach(() => {
                result = createEnvelope({
                    type: "publish",
                    channel: "orders",
                    topic: "item.placed",
                    payload: { sku: "FLUX-CAPACITOR-MK1" },
                });
            });

            it("should set all required fields with a generated id and timestamp", () => {
                expect(result).toEqual({
                    id: expect.any(String),
                    type: "publish",
                    channel: "orders",
                    topic: "item.placed",
                    payload: { sku: "FLUX-CAPACITOR-MK1" },
                    timestamp: FROZEN_TIME,
                });
            });

            it("should generate a valid UUID v4 for the id", () => {
                expect(result.id).toMatch(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                );
            });

            it("should not include optional fields on the envelope object", () => {
                expect(result).not.toHaveProperty("source");
                expect(result).not.toHaveProperty("replyTo");
                expect(result).not.toHaveProperty("correlationId");
            });
        });

        describe("when creating an envelope with all optional fields", () => {
            let result: Envelope<{ sku: string }>;

            beforeEach(() => {
                result = createEnvelope({
                    type: "request",
                    channel: "orders",
                    topic: "pricing.calculate",
                    payload: { sku: "DL0R34N" },
                    source: "worker-1",
                    replyTo: "pricing.calculate.reply",
                    correlationId: "corr-8675309",
                });
            });

            it("should include all fields", () => {
                expect(result).toEqual({
                    id: expect.any(String),
                    type: "request",
                    channel: "orders",
                    topic: "pricing.calculate",
                    payload: { sku: "DL0R34N" },
                    timestamp: FROZEN_TIME,
                    source: "worker-1",
                    replyTo: "pricing.calculate.reply",
                    correlationId: "corr-8675309",
                });
            });
        });

        describe("when creating two envelopes", () => {
            let first: Envelope, second: Envelope;

            beforeEach(() => {
                first = createEnvelope({
                    type: "publish",
                    channel: "orders",
                    topic: "item.placed",
                    payload: {},
                });
                second = createEnvelope({
                    type: "publish",
                    channel: "orders",
                    topic: "item.placed",
                    payload: {},
                });
            });

            it("should generate different IDs", () => {
                expect(first.id).not.toBe(second.id);
            });
        });
    });
});
