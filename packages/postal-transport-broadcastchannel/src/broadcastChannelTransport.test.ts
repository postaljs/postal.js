/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { Envelope, Transport } from "postal";
import { createBroadcastChannelTransport } from "./broadcastChannelTransport";

// --- BroadcastChannel mock ---
// We mock BroadcastChannel globally so tests can control message delivery
// without relying on actual cross-instance async dispatch in Node.
// The global is set per-test in beforeEach so each transport gets a fresh mock.

const mockPostMessage = jest.fn();
const mockClose = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

const MockBroadcastChannel = jest.fn();

// --- Helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-NCC-1701",
    type: "publish",
    channel: "bridge",
    topic: "photon.fired",
    payload: { yield: "maximum" },
    timestamp: 1701000000000,
    ...overrides,
});

/**
 * Retrieves the "message" event listener registered by the transport on the
 * mock BroadcastChannel instance, then invokes it with the given data.
 * This simulates an inbound BroadcastChannel message arriving.
 */
const fireInboundMessage = (data: unknown): void => {
    const calls = mockAddEventListener.mock.calls;
    const messageCall = calls.find(([event]: [string, any]) => event === "message");
    if (!messageCall) {
        throw new Error("No 'message' event listener was registered");
    }
    const handler = messageCall[1] as (event: MessageEvent) => void;
    handler({ data } as MessageEvent);
};

describe("createBroadcastChannelTransport", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        MockBroadcastChannel.mockImplementation((_name: string) => ({
            postMessage: mockPostMessage,
            close: mockClose,
            addEventListener: mockAddEventListener,
            removeEventListener: mockRemoveEventListener,
        }));

        // Install mock before each test — the factory references `global.BroadcastChannel`
        // at call time (not module load time), so this is sufficient.
        (global as any).BroadcastChannel = MockBroadcastChannel;
    });

    afterEach(() => {
        delete (global as any).BroadcastChannel;
    });

    describe("when creating a transport with the default name", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            transport.dispose?.();
        });

        it("should instantiate BroadcastChannel with 'postal'", () => {
            expect(MockBroadcastChannel).toHaveBeenCalledTimes(1);
            expect(MockBroadcastChannel).toHaveBeenCalledWith("postal");
        });
    });

    describe("when creating a transport with a custom name", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport("my-app");
            transport.dispose?.();
        });

        it("should instantiate BroadcastChannel with the custom name", () => {
            expect(MockBroadcastChannel).toHaveBeenCalledTimes(1);
            expect(MockBroadcastChannel).toHaveBeenCalledWith("my-app");
        });
    });

    describe("when send is called on an active transport", () => {
        let transport: Transport;
        let envelope: Envelope;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            envelope = makeEnvelope({ topic: "warp.engaged" });
            transport.send(envelope);
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should call postMessage once", () => {
            expect(mockPostMessage).toHaveBeenCalledTimes(1);
        });

        it("should wrap the envelope in the postal:envelope protocol shape", () => {
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "postal:envelope",
                    envelope,
                })
            );
        });
    });

    describe("when send is called after dispose", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            transport.dispose?.();
            transport.send(makeEnvelope());
        });

        it("should not call postMessage", () => {
            expect(mockPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when an inbound postal:envelope message arrives", () => {
        let transport: Transport;
        let receivedEnvelope: Envelope;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            transport.subscribe(env => {
                receivedEnvelope = env;
            });
            const envelope = makeEnvelope({ topic: "shields.up" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should deliver the envelope to the subscriber", () => {
            expect(receivedEnvelope).toEqual(expect.objectContaining({ topic: "shields.up" }));
        });
    });

    describe("when a non-postal message arrives on the channel", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            callback = jest.fn();
            transport.subscribe(callback);
            fireInboundMessage({ random: "garbage" });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not call the subscriber", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when a message arrives after the transport is disposed", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            callback = jest.fn();
            transport.subscribe(callback);
            transport.dispose?.();
            // Simulate the event still firing (removeEventListener is a no-op on the mock)
            const envelope = makeEnvelope();
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        it("should not call the subscriber", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when a subscriber unsubscribes", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            callback = jest.fn();
            const unsub = transport.subscribe(callback);
            unsub();
            const envelope = makeEnvelope();
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not receive further messages", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when unsubscribe is called twice", () => {
        let transport: Transport;
        let unsub: () => void;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            unsub = transport.subscribe(jest.fn());
            unsub();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not throw", () => {
            expect(() => unsub()).not.toThrow();
        });
    });

    describe("when dispose is called", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            transport.dispose?.();
        });

        it("should remove the message event listener", () => {
            expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
            expect(mockRemoveEventListener).toHaveBeenCalledWith("message", expect.any(Function));
        });

        it("should close the underlying BroadcastChannel", () => {
            expect(mockClose).toHaveBeenCalledTimes(1);
        });

        describe("when subscribe is called after dispose", () => {
            let callback: jest.Mock;
            let unsub: () => void;

            beforeEach(() => {
                callback = jest.fn();
                unsub = transport.subscribe(callback);
                const envelope = makeEnvelope();
                fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
            });

            it("should return a callable no-op", () => {
                expect(() => unsub()).not.toThrow();
            });

            it("should not invoke the callback", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    describe("when dispose is called twice", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            transport.dispose?.();
            transport.dispose?.();
        });

        it("should close the channel only once", () => {
            expect(mockClose).toHaveBeenCalledTimes(1);
        });
    });

    describe("when a postal message arrives and there are no subscribers", () => {
        let transport: Transport;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            const envelope = makeEnvelope({ topic: "ghost.signal" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not throw", () => {
            // Zero-listener fan-out — the for-of over an empty snapshot is a no-op.
            // This test exists to prove the transport doesn't blow up when no one is home.
            expect(true).toBe(true);
        });
    });

    describe("when multiple subscribers are active", () => {
        let transport: Transport;
        let callbackA: jest.Mock, callbackB: jest.Mock;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            callbackA = jest.fn();
            callbackB = jest.fn();
            transport.subscribe(callbackA);
            transport.subscribe(callbackB);
            const envelope = makeEnvelope({ topic: "all.hands" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should deliver the envelope to all subscribers", () => {
            expect(callbackA).toHaveBeenCalledTimes(1);
            expect(callbackB).toHaveBeenCalledTimes(1);
        });

        it("should pass the same envelope to each subscriber", () => {
            expect(callbackA).toHaveBeenCalledWith(expect.objectContaining({ topic: "all.hands" }));
            expect(callbackB).toHaveBeenCalledWith(expect.objectContaining({ topic: "all.hands" }));
        });
    });

    describe("when the same callback is subscribed twice and unsubscribed once", () => {
        let transport: Transport;
        let sharedCallback: jest.Mock;

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            sharedCallback = jest.fn();
            const unsubFirst = transport.subscribe(sharedCallback);
            transport.subscribe(sharedCallback);
            // Only remove the first registration — indexOf splices position 0.
            unsubFirst();
            const envelope = makeEnvelope({ topic: "double.agent" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should still call the callback once (the second registration remains)", () => {
            expect(sharedCallback).toHaveBeenCalledTimes(1);
        });
    });

    describe("when one listener throws during message delivery", () => {
        let transport: Transport, queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(() => {
            thrownError = new Error("E_DILITHIUM_CRYSTALS");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createBroadcastChannelTransport();
            callbackA = jest.fn();
            callbackB = jest.fn().mockImplementation(() => {
                throw thrownError;
            });
            callbackC = jest.fn();
            transport.subscribe(callbackA);
            transport.subscribe(callbackB);
            transport.subscribe(callbackC);

            const envelope = makeEnvelope({ topic: "red.alert" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should still call the listeners after the throwing one", () => {
            expect(callbackA).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledTimes(1);
        });

        it("should pass the envelope to all non-throwing listeners", () => {
            expect(callbackA).toHaveBeenCalledWith(expect.objectContaining({ topic: "red.alert" }));
            expect(callbackC).toHaveBeenCalledWith(expect.objectContaining({ topic: "red.alert" }));
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

    describe("when a listener unsubscribes during iteration (snapshot safety)", () => {
        let transport: Transport;
        let callOrder: string[];

        beforeEach(() => {
            transport = createBroadcastChannelTransport();
            callOrder = [];

            let unsubB: (() => void) | undefined;

            // Listener A unsubscribes B mid-iteration to prove the snapshot protects B
            transport.subscribe(() => {
                callOrder.push("A");
                unsubB?.();
            });

            unsubB = transport.subscribe(() => {
                callOrder.push("B");
            });

            const envelope = makeEnvelope();
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should still call B because the snapshot was taken before iteration", () => {
            expect(callOrder).toEqual(["A", "B"]);
        });
    });

    describe("when multiple listeners throw during message delivery", () => {
        let transport: Transport, queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let errorA: Error, errorB: Error;

        beforeEach(() => {
            errorA = new Error("E_PHOTON_TORPEDO_MISFIRE");
            errorB = new Error("E_SHIELD_GENERATOR_OFFLINE");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createBroadcastChannelTransport();
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

            const envelope = makeEnvelope({ topic: "abandon.ship" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should still deliver the envelope to the non-throwing listener", () => {
            expect(callbackC).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "abandon.ship" })
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

    describe("when a throwing listener coexists with a listener that unsubscribes another", () => {
        let transport: Transport, queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(() => {
            thrownError = new Error("E_TRANSPORTER_MALFUNCTION");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            transport = createBroadcastChannelTransport();
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

            const envelope = makeEnvelope({ topic: "pattern.buffer.corrupt" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should still deliver the envelope to C despite A throwing and B unsubscribing C", () => {
            expect(callbackC).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledWith(
                expect.objectContaining({ topic: "pattern.buffer.corrupt" })
            );
        });

        it("should queue a microtask for the throwing listener", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            const microtaskFn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => microtaskFn()).toThrow(thrownError);
        });
    });
});
