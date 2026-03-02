export default {};

import type { Transport, Envelope } from "postal";
import { createMessagePortTransport } from "./messagePortTransport";

// --- Helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: crypto.randomUUID(),
    type: "publish",
    channel: "orders",
    topic: "item.placed",
    payload: { sku: "HOVERBOARD-2015" },
    timestamp: Date.now(),
    ...overrides,
});

/**
 * Waits for a single envelope to arrive on a transport.
 * Resolves with the envelope; rejects after 2s.
 */
const waitForMessage = (transport: Transport): Promise<Envelope> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for message")), 2000);
        const unsub = transport.subscribe(envelope => {
            clearTimeout(timer);
            unsub();
            resolve(envelope);
        });
    });
};

describe("createMessagePortTransport", () => {
    let channel: MessageChannel;
    let transportA: Transport;
    let transportB: Transport;

    beforeEach(() => {
        channel = new MessageChannel();
        transportA = createMessagePortTransport(channel.port1);
        transportB = createMessagePortTransport(channel.port2);
    });

    afterEach(() => {
        transportA.dispose?.();
        transportB.dispose?.();
    });

    describe("when sending an envelope from one port", () => {
        it("should deliver to subscribers on the other port", async () => {
            const promise = waitForMessage(transportB);
            transportA.send(makeEnvelope({ topic: "item.placed" }));
            const received = await promise;
            expect(received.topic).toBe("item.placed");
            expect(received.payload).toEqual({ sku: "HOVERBOARD-2015" });
        });

        it("should preserve all envelope fields", async () => {
            const original = makeEnvelope({
                source: "remote-instance",
                replyTo: "system.rpc.response.abc",
                correlationId: "corr-123",
            });
            const promise = waitForMessage(transportB);
            transportA.send(original);
            const received = await promise;
            expect(received.id).toBe(original.id);
            expect(received.type).toBe(original.type);
            expect(received.channel).toBe(original.channel);
            expect(received.topic).toBe(original.topic);
            expect(received.timestamp).toBe(original.timestamp);
            expect(received.source).toBe("remote-instance");
            expect(received.replyTo).toBe("system.rpc.response.abc");
            expect(received.correlationId).toBe("corr-123");
        });
    });

    describe("when multiple subscribers are registered", () => {
        it("should deliver to all subscribers", async () => {
            const callbackA = jest.fn();
            const callbackB = jest.fn();
            transportB.subscribe(callbackA);
            transportB.subscribe(callbackB);

            transportA.send(makeEnvelope());

            // Give the MessagePort time to deliver
            await new Promise(r => setTimeout(r, 50));

            expect(callbackA).toHaveBeenCalledTimes(1);
            expect(callbackB).toHaveBeenCalledTimes(1);
        });
    });

    describe("when a subscriber unsubscribes", () => {
        it("should stop receiving messages", async () => {
            const stayCallback = jest.fn();
            const leaveCallback = jest.fn();
            transportB.subscribe(stayCallback);
            const unsub = transportB.subscribe(leaveCallback);
            unsub();

            transportA.send(makeEnvelope());
            await new Promise(r => setTimeout(r, 50));

            expect(stayCallback).toHaveBeenCalledTimes(1);
            expect(leaveCallback).not.toHaveBeenCalled();
        });

        it("should be idempotent", () => {
            const callback = jest.fn();
            const unsub = transportB.subscribe(callback);
            unsub();
            expect(() => unsub()).not.toThrow();
        });
    });

    describe("when the transport is disposed", () => {
        it("should not deliver messages after dispose", async () => {
            const callback = jest.fn();
            transportB.subscribe(callback);
            transportB.dispose?.();

            transportA.send(makeEnvelope());
            await new Promise(r => setTimeout(r, 50));

            expect(callback).not.toHaveBeenCalled();
        });

        it("should silently no-op on send after dispose", () => {
            transportA.dispose?.();
            expect(() => transportA.send(makeEnvelope())).not.toThrow();
        });

        it("should be idempotent", () => {
            transportA.dispose?.();
            expect(() => transportA.dispose?.()).not.toThrow();
        });
    });

    describe("when non-postal messages are posted on the port", () => {
        it("should ignore them", async () => {
            const callback = jest.fn();
            transportB.subscribe(callback);

            // Post raw data directly — not wrapped in postal:envelope
            channel.port1.postMessage({ random: "garbage" });
            channel.port1.postMessage("just a string");
            channel.port1.postMessage(42);

            await new Promise(r => setTimeout(r, 50));

            expect(callback).not.toHaveBeenCalled();
        });

        it("should still deliver postal envelopes alongside noise", async () => {
            const callback = jest.fn();
            transportB.subscribe(callback);

            channel.port1.postMessage({ random: "noise" });
            transportA.send(makeEnvelope({ topic: "the.real.deal" }));
            channel.port1.postMessage({ more: "noise" });

            await new Promise(r => setTimeout(r, 50));

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback.mock.calls[0][0].topic).toBe("the.real.deal");
        });
    });

    describe("when malformed postal:envelope messages are posted", () => {
        it("should ignore messages with missing envelope field", async () => {
            const callback = jest.fn();
            transportB.subscribe(callback);

            // Has the right type but no envelope property
            channel.port1.postMessage({ type: "postal:envelope" });

            await new Promise(r => setTimeout(r, 50));

            expect(callback).not.toHaveBeenCalled();
        });

        it("should ignore messages with null envelope field", async () => {
            const callback = jest.fn();
            transportB.subscribe(callback);

            channel.port1.postMessage({ type: "postal:envelope", envelope: null });

            await new Promise(r => setTimeout(r, 50));

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when envelopes have nested payloads", () => {
        it("should survive structured clone serialization", async () => {
            const payload = {
                items: [{ sku: "FLUX-CAPACITOR", qty: 1 }],
                metadata: { nested: { deep: true } },
            };
            const promise = waitForMessage(transportB);
            transportA.send(makeEnvelope({ payload }));
            const received = await promise;
            expect(received.payload).toEqual(payload);
        });
    });
});
