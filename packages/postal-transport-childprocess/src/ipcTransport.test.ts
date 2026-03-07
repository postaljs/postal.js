/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { Envelope, Transport } from "postal";
import { createIPCTransport, type IPCEndpoint } from "./ipcTransport";
import { createEnvelopeMessage } from "./protocol";

// --- Mock endpoint helpers ---

const createMockEndpoint = () => {
    const handlers = new Map<string, Set<(message: unknown) => void>>();

    const mockSend = jest.fn();
    const mockOn = jest.fn((event: string, handler: (message: unknown) => void) => {
        if (!handlers.has(event)) {
            handlers.set(event, new Set());
        }
        handlers.get(event)!.add(handler);
    });
    const mockRemoveListener = jest.fn((event: string, handler: (message: unknown) => void) => {
        handlers.get(event)?.delete(handler);
    });

    const endpoint = {
        send: mockSend,
        on: mockOn,
        removeListener: mockRemoveListener,
    } as unknown as IPCEndpoint;

    const receive = (message: unknown): void => {
        const messageHandlers = handlers.get("message");
        if (messageHandlers) {
            for (const handler of messageHandlers) {
                handler(message);
            }
        }
    };

    return { endpoint, mockSend, mockOn, mockRemoveListener, receive };
};

// --- Test helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-1985",
    type: "publish",
    channel: "timeline",
    topic: "delorean.ready",
    payload: { speed: 88 },
    timestamp: 1234567890,
    ...overrides,
});

describe("createIPCTransport", () => {
    describe("send", () => {
        describe("when send is called with an envelope", () => {
            let mockSend: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { endpoint, mockSend: ms } = createMockEndpoint();
                mockSend = ms;
                const transport = createIPCTransport(endpoint);
                envelope = makeEnvelope({ topic: "flux.capacitor.charged" });
                transport.send(envelope);
            });

            it("should call endpoint.send once", () => {
                expect(mockSend).toHaveBeenCalledTimes(1);
            });

            it("should wrap the envelope in an EnvelopeMessage", () => {
                expect(mockSend).toHaveBeenCalledWith(createEnvelopeMessage(envelope));
            });
        });

        describe("when send is called after dispose", () => {
            let mockSend: jest.Mock;

            beforeEach(() => {
                const { endpoint, mockSend: ms } = createMockEndpoint();
                mockSend = ms;
                const transport = createIPCTransport(endpoint);
                transport.dispose?.();
                transport.send(makeEnvelope());
            });

            it("should not call endpoint.send", () => {
                expect(mockSend).not.toHaveBeenCalled();
            });
        });
    });

    describe("subscribe", () => {
        describe("when an envelope message arrives", () => {
            let callback: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callback = jest.fn();
                transport.subscribe(callback);
                envelope = makeEnvelope({ topic: "roads.not.needed" });
                receive(createEnvelopeMessage(envelope));
            });

            it("should invoke the subscriber with the envelope", () => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback).toHaveBeenCalledWith(envelope);
            });
        });

        describe("when multiple subscribers are registered", () => {
            let callbackA: jest.Mock, callbackB: jest.Mock;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callbackA = jest.fn();
                callbackB = jest.fn();
                transport.subscribe(callbackA);
                transport.subscribe(callbackB);
                receive(createEnvelopeMessage(makeEnvelope()));
            });

            it("should deliver to all subscribers", () => {
                expect(callbackA).toHaveBeenCalledTimes(1);
                expect(callbackB).toHaveBeenCalledTimes(1);
            });
        });

        describe("when an inbound message is malformed", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callback = jest.fn();
                transport.subscribe(callback);
                receive({ garbage: true });
                receive("just a string");
                receive(null);
                receive({ type: "postal:envelope" }); // missing envelope field
            });

            it("should not invoke the subscriber", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("when a subscriber unsubscribes during delivery (snapshot iteration)", () => {
            let callbackA: jest.Mock, callbackC: jest.Mock;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callbackA = jest.fn();
                callbackC = jest.fn();

                let unsubC: (() => void) | undefined;

                transport.subscribe(callbackA);
                transport.subscribe(() => {
                    // B unsubscribes C mid-iteration — C must still be called
                    // because the snapshot was taken before iteration started
                    unsubC?.();
                });
                unsubC = transport.subscribe(callbackC);

                receive(createEnvelopeMessage(makeEnvelope({ topic: "marty.time" })));
            });

            it("should still deliver to the late-unsubscribed listener", () => {
                expect(callbackC).toHaveBeenCalledTimes(1);
            });

            it("should deliver to all listeners in the snapshot", () => {
                expect(callbackA).toHaveBeenCalledTimes(1);
            });
        });

        describe("when a listener throws during delivery", () => {
            let queueMicrotaskSpy: jest.SpyInstance,
                callbackA: jest.Mock,
                callbackC: jest.Mock,
                thrownError: Error;

            beforeEach(() => {
                thrownError = new Error("E_WARP_CORE_BREACH");
                queueMicrotaskSpy = jest
                    .spyOn(globalThis, "queueMicrotask")
                    .mockImplementation(() => {});

                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);

                callbackA = jest.fn();
                const callbackB = jest.fn().mockImplementation(() => {
                    throw thrownError;
                });
                callbackC = jest.fn();

                transport.subscribe(callbackA);
                transport.subscribe(callbackB);
                transport.subscribe(callbackC);

                receive(createEnvelopeMessage(makeEnvelope({ topic: "battle.stations" })));
            });

            afterEach(() => {
                queueMicrotaskSpy.mockRestore();
            });

            it("should still deliver to listeners before and after the throwing one", () => {
                expect(callbackA).toHaveBeenCalledTimes(1);
                expect(callbackC).toHaveBeenCalledTimes(1);
            });

            it("should re-throw via queueMicrotask", () => {
                expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            });

            it("should queue a function that re-throws the original error", () => {
                const microtaskFn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
                expect(() => microtaskFn()).toThrow(thrownError);
            });
        });

        describe("when subscribe is called after dispose", () => {
            let callback: jest.Mock, unsub: () => void;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callback = jest.fn();
                transport.dispose?.();
                unsub = transport.subscribe(callback);
                // Simulate a message arriving after disposal
                receive(createEnvelopeMessage(makeEnvelope()));
            });

            it("should return a callable no-op", () => {
                expect(() => unsub()).not.toThrow();
            });

            it("should never invoke the callback", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("when unsubscribe is called twice", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { endpoint } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callback = jest.fn();
                const unsub = transport.subscribe(callback);
                unsub();
                unsub(); // second call should be a no-op
            });

            it("should not throw", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    describe("dispose", () => {
        describe("when dispose is called", () => {
            let mockRemoveListener: jest.Mock, transport: Transport;

            beforeEach(() => {
                const { endpoint, mockRemoveListener: mrl } = createMockEndpoint();
                mockRemoveListener = mrl;
                transport = createIPCTransport(endpoint);
                transport.dispose?.();
            });

            it("should call removeListener to detach the message handler", () => {
                expect(mockRemoveListener).toHaveBeenCalledTimes(1);
                expect(mockRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
            });
        });

        describe("when dispose is called twice (idempotent)", () => {
            let mockRemoveListener: jest.Mock;

            beforeEach(() => {
                const { endpoint, mockRemoveListener: mrl } = createMockEndpoint();
                mockRemoveListener = mrl;
                const transport = createIPCTransport(endpoint);
                transport.dispose?.();
                transport.dispose?.();
            });

            it("should only call removeListener once", () => {
                expect(mockRemoveListener).toHaveBeenCalledTimes(1);
            });
        });

        describe("when dispose is called — process lifecycle invariant", () => {
            let endpoint: IPCEndpoint;

            beforeEach(() => {
                const mock = createMockEndpoint();
                endpoint = mock.endpoint;
                const transport = createIPCTransport(endpoint);
                // Add an imaginary kill/disconnect to verify we don't call it
                (endpoint as any).kill = jest.fn();
                (endpoint as any).disconnect = jest.fn();
                transport.dispose?.();
            });

            it("should NOT call endpoint.kill", () => {
                expect((endpoint as any).kill).not.toHaveBeenCalled();
            });

            it("should NOT call endpoint.disconnect", () => {
                expect((endpoint as any).disconnect).not.toHaveBeenCalled();
            });
        });

        describe("when a message arrives after dispose", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { endpoint, receive } = createMockEndpoint();
                const transport = createIPCTransport(endpoint);
                callback = jest.fn();
                transport.subscribe(callback);
                transport.dispose?.();
                // The onMessage handler is still technically reachable through the
                // handlers map in our mock (removeListener just removes from the set),
                // but the disposed guard inside onMessage should prevent delivery.
                receive(createEnvelopeMessage(makeEnvelope()));
            });

            it("should not invoke subscribers", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });
});
