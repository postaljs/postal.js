/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import {
    addTransport,
    getChannel,
    resetChannels,
    type Transport,
    type Envelope,
    type TransportSendMeta,
} from "postal";
import { createMessagePortTransport } from "./messagePortTransport";
import { markTransferable } from "./transferables";

// --- Mock port helpers ---
// Used by error-isolation and disposed-guard tests that need synchronous,
// controlled message delivery without real MessageChannel async dispatch.

const mockPostMessage = jest.fn();
const mockClose = jest.fn();
const mockPortAddEventListener = jest.fn();
const mockPortRemoveEventListener = jest.fn();
const mockStart = jest.fn();

const makeMockPort = (): MessagePort =>
    ({
        postMessage: mockPostMessage,
        close: mockClose,
        addEventListener: mockPortAddEventListener,
        removeEventListener: mockPortRemoveEventListener,
        start: mockStart,
    }) as unknown as MessagePort;

/**
 * Fires the "message" handler registered by the transport on the mock port.
 * Simulates an inbound MessagePort message arriving synchronously.
 */
const fireMockInboundMessage = (data: unknown): void => {
    const calls = mockPortAddEventListener.mock.calls;
    const messageCall = calls.find(([event]: [string, any]) => event === "message");
    if (!messageCall) {
        throw new Error("No 'message' event listener was registered");
    }
    const handler = messageCall[1] as (event: MessageEvent) => void;
    handler({ data } as MessageEvent);
};

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

// --- Mock-port tests: synchronous control for error isolation and disposed guard ---
// These live outside the real-MessageChannel suite because they need to fire
// onMessage synchronously and spy on queueMicrotask without async delays.

describe("createMessagePortTransport (mock port)", () => {
    let transport: Transport;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        transport?.dispose?.();
    });

    describe("when one listener throws during message delivery", () => {
        let queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(() => {
            thrownError = new Error("E_WARP_CORE_BREACH");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createMessagePortTransport(makeMockPort());
            callbackA = jest.fn();
            callbackB = jest.fn().mockImplementation(() => {
                throw thrownError;
            });
            callbackC = jest.fn();
            transport.subscribe(callbackA);
            transport.subscribe(callbackB);
            transport.subscribe(callbackC);

            const envelope = makeEnvelope({ topic: "battle.stations" });
            fireMockInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
        });

        it("should still call the listeners after the throwing one", () => {
            expect(callbackA).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledTimes(1);
        });

        it("should pass the envelope to all non-throwing listeners", () => {
            expect(callbackA).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "battle.stations" })
            );
            expect(callbackC).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "battle.stations" })
            );
        });

        it("should re-throw the error via queueMicrotask", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            expect(queueMicrotaskSpy).toHaveBeenCalledWith(expect.any(Function));
        });

        it("should pass a function that throws the original error to queueMicrotask", () => {
            const microtaskFn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => microtaskFn()).toThrow(thrownError);
        });
    });

    describe("when subscribe is called after dispose", () => {
        let callback: jest.Mock;
        let unsub: () => void;

        beforeEach(() => {
            transport = createMessagePortTransport(makeMockPort());
            callback = jest.fn();
            transport.dispose?.();
            unsub = transport.subscribe(callback);
            fireMockInboundMessage({
                type: "postal:envelope",
                version: 1,
                envelope: makeEnvelope(),
            });
        });

        it("should return a callable no-op", () => {
            expect(() => unsub()).not.toThrow();
        });

        it("should never invoke the callback", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when multiple listeners throw during message delivery", () => {
        let queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let errorA: Error, errorB: Error;

        beforeEach(() => {
            errorA = new Error("E_FLUX_CAPACITOR_OVERLOAD");
            errorB = new Error("E_JIGOWATTS_INSUFFICIENT");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createMessagePortTransport(makeMockPort());
            callbackA = jest.fn().mockImplementation(() => {
                throw errorA;
            });
            callbackB = jest.fn().mockImplementation(() => {
                throw errorB;
            });
            callbackC = jest.fn();
            transport.subscribe(callbackA);
            transport.subscribe(callbackB);
            transport.subscribe(callbackC);

            const envelope = makeEnvelope({ topic: "time.travel.failed" });
            fireMockInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
        });

        it("should still deliver the envelope to the non-throwing listener", () => {
            expect(callbackC).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "time.travel.failed" })
            );
        });

        it("should queue a microtask for each throwing listener", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(2);
        });

        it("should queue a microtask that re-throws the first error", () => {
            const firstMicrotask = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => firstMicrotask()).toThrow(errorA);
        });

        it("should queue a microtask that re-throws the second error", () => {
            const secondMicrotask = queueMicrotaskSpy.mock.calls[1][0] as () => void;
            expect(() => secondMicrotask()).toThrow(errorB);
        });
    });

    describe("when send is called without markTransferable", () => {
        let envelope: Envelope;

        beforeEach(() => {
            transport = createMessagePortTransport(makeMockPort());
            envelope = makeEnvelope({ payload: { sku: "PLAIN-ENVELOPE" } });
            transport.send(envelope);
        });

        it("should call postMessage with an empty transfer list", () => {
            expect(mockPostMessage).toHaveBeenCalledTimes(1);
            expect(mockPostMessage).toHaveBeenCalledWith(expect.any(Object), []);
        });
    });

    describe("when send is called with markTransferable and peerCount of 1", () => {
        let buffer: ArrayBuffer;
        let envelope: Envelope;
        const singlePeerMeta: TransportSendMeta = { peerCount: 1 };

        beforeEach(() => {
            transport = createMessagePortTransport(makeMockPort());
            buffer = new ArrayBuffer(64);
            const payload = markTransferable({ frame: "WEBCAM-FRAME" }, [buffer]);
            envelope = makeEnvelope({ payload });
            transport.send(envelope, singlePeerMeta);
        });

        it("should call postMessage with the transfer list", () => {
            expect(mockPostMessage).toHaveBeenCalledTimes(1);
            expect(mockPostMessage).toHaveBeenCalledWith(expect.any(Object), [buffer]);
        });
    });

    describe("when send is called with markTransferable and peerCount greater than 1", () => {
        let envelope: Envelope;
        const multiPeerMeta: TransportSendMeta = { peerCount: 2 };

        beforeEach(() => {
            transport = createMessagePortTransport(makeMockPort());
            const buffer = new ArrayBuffer(64);
            const payload = markTransferable({ frame: "SHARED-FRAME" }, [buffer]);
            envelope = makeEnvelope({ payload });
            transport.send(envelope, multiPeerMeta);
        });

        it("should call postMessage without a transfer list (structured clone fallback)", () => {
            expect(mockPostMessage).toHaveBeenCalledTimes(1);
            expect(mockPostMessage).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    describe("when send is called on a disposed transport with a marked payload", () => {
        let buffer: ArrayBuffer;

        beforeEach(() => {
            transport = createMessagePortTransport(makeMockPort());
            buffer = new ArrayBuffer(32);
            const payload = markTransferable({ frame: "DISPOSED-FRAME" }, [buffer]);
            const envelope = makeEnvelope({ payload });
            transport.dispose?.();
            transport.send(envelope);
        });

        it("should not call postMessage", () => {
            expect(mockPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when two transports share the same marked payload", () => {
        let transportB: Transport;
        let mockPostMessageB: jest.Mock;

        beforeEach(() => {
            mockPostMessageB = jest.fn();
            const mockPortB = {
                postMessage: mockPostMessageB,
                close: jest.fn(),
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                start: jest.fn(),
            } as unknown as MessagePort;

            transport = createMessagePortTransport(makeMockPort());
            transportB = createMessagePortTransport(mockPortB);

            const buffer = new ArrayBuffer(128);
            const payload = markTransferable({ frame: "CONTESTED-FRAME" }, [buffer]);
            const envelope = makeEnvelope({ payload });
            const multiMeta: TransportSendMeta = { peerCount: 2 };

            // First transport consumes the WeakMap entry (but peerCount > 1 so it clones)
            transport.send(envelope, multiMeta);
            // Second transport finds nothing in the WeakMap — also clones
            transportB.send(envelope, multiMeta);
        });

        afterEach(() => {
            transportB?.dispose?.();
        });

        it("should call postMessage on the first transport without a transfer list", () => {
            expect(mockPostMessage).toHaveBeenCalledTimes(1);
            expect(mockPostMessage).toHaveBeenCalledWith(expect.any(Object));
        });

        it("should call postMessage on the second transport without a transfer list", () => {
            expect(mockPostMessageB).toHaveBeenCalledTimes(1);
            expect(mockPostMessageB).toHaveBeenCalledWith(expect.any(Object), []);
        });
    });

    describe("when a throwing listener coexists with a listener that unsubscribes another", () => {
        let queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(() => {
            thrownError = new Error("E_HOVERBOARD_POWER_FAILURE");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createMessagePortTransport(makeMockPort());
            callbackA = jest.fn().mockImplementation(() => {
                throw thrownError;
            });
            callbackC = jest.fn();

            let unsubC: (() => void) | undefined;

            // A throws. B unsubscribes C mid-iteration. C must still be delivered
            // because the snapshot was taken before iteration began.
            transport.subscribe(callbackA);
            transport.subscribe(() => {
                unsubC?.();
            });
            unsubC = transport.subscribe(callbackC);

            const envelope = makeEnvelope({ topic: "roads.not.needed" });
            fireMockInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
        });

        it("should still deliver the envelope to C despite A throwing and B unsubscribing C", () => {
            expect(callbackC).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "roads.not.needed" })
            );
        });

        it("should queue a microtask for the throwing listener", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            const microtaskFn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => microtaskFn()).toThrow(thrownError);
        });
    });
});

// --- Integration tests: real MessageChannel transfer semantics ---
// These tests prove the full flow using real MessageChannel instances where
// postMessage actually neuters transferred ArrayBuffers. Mock-port tests
// above verify code paths; these verify the real-world observable contract.

describe("createMessagePortTransport (transferable integration)", () => {
    beforeEach(() => {
        resetChannels();
    });

    afterEach(() => {
        resetChannels();
    });

    describe("when a single transport receives a marked payload", () => {
        let buffer: ArrayBuffer;
        let receivedPayload: unknown;

        beforeEach(async () => {
            // port1 is the sender side (registered as transport), port2 is the receiver
            const channel = new MessageChannel();
            const senderTransport = createMessagePortTransport(channel.port1);
            const receiverTransport = createMessagePortTransport(channel.port2);

            addTransport(senderTransport);

            const receivePromise = waitForMessage(receiverTransport);

            buffer = new ArrayBuffer(16);
            const view = new Uint8Array(buffer);
            view[0] = 0xde;
            view[1] = 0xad;

            const payload = markTransferable({ frame: "NEUTRINO-DETECTOR-FRAME" }, [buffer]);
            const postalChannel = getChannel("neutrinos");
            postalChannel.publish("frame.ready", payload);

            const received = await receivePromise;
            receivedPayload = received.payload;

            receiverTransport.dispose?.();
        });

        it("should neuter the sender buffer after transfer", () => {
            // A transferred ArrayBuffer has its backing memory detached — byteLength drops to 0
            expect(buffer.byteLength).toBe(0);
        });

        it("should deliver the buffer contents to the receiver intact", () => {
            const receivedBuffer = (receivedPayload as { frame: string; [key: string]: unknown })
                .frame;
            // The receiver payload should still have the frame field, proving structured data arrived
            expect(receivedBuffer).toBe("NEUTRINO-DETECTOR-FRAME");
        });
    });

    describe("when two transports both receive a marked payload", () => {
        let buffer: ArrayBuffer;
        let receivedA: Envelope, receivedB: Envelope;

        beforeEach(async () => {
            const channelA = new MessageChannel();
            const channelB = new MessageChannel();

            const senderTransportA = createMessagePortTransport(channelA.port1);
            const senderTransportB = createMessagePortTransport(channelB.port1);
            const receiverTransportA = createMessagePortTransport(channelA.port2);
            const receiverTransportB = createMessagePortTransport(channelB.port2);

            // Two transports registered → broadcastToTransports yields peerCount: 2
            addTransport(senderTransportA);
            addTransport(senderTransportB);

            const promiseA = waitForMessage(receiverTransportA);
            const promiseB = waitForMessage(receiverTransportB);

            buffer = new ArrayBuffer(24);
            const view = new Uint8Array(buffer);
            view[0] = 0xbe;
            view[1] = 0xef;

            const payload = markTransferable({ clip: "GREAT-SCOTT-MOMENT" }, [buffer]);
            const postalChannel = getChannel("delorean");
            postalChannel.publish("frame.captured", payload);

            [receivedA, receivedB] = await Promise.all([promiseA, promiseB]);

            receiverTransportA.dispose?.();
            receiverTransportB.dispose?.();
        });

        it("should NOT neuter the sender buffer when peerCount is greater than 1", () => {
            // Structured clone is used — the sender's ArrayBuffer is preserved
            expect(buffer.byteLength).toBe(24);
        });

        it("should deliver the payload to both receivers", () => {
            expect((receivedA.payload as any).clip).toBe("GREAT-SCOTT-MOMENT");
            expect((receivedB.payload as any).clip).toBe("GREAT-SCOTT-MOMENT");
        });
    });
});
