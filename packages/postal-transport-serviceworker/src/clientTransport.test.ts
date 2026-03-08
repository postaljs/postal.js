/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { Envelope, Transport } from "postal";
import { createClientTransport } from "./clientTransport";
import { PostalServiceWorkerError } from "./errors";

// --- Mock setup ---
// We assign mocks to globalThis.navigator before each test.
// The transport reads navigator.serviceWorker at call time (not module load time),
// so assigning before the factory call is sufficient.

const mockControllerPostMessage = jest.fn();
const mockSwAddEventListener = jest.fn();
const mockSwRemoveEventListener = jest.fn();

// --- Helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-42",
    type: "publish",
    channel: "deep-space-9",
    topic: "runabout.departed",
    payload: { destination: "gamma-quadrant" },
    timestamp: 2369000000000,
    ...overrides,
});

/**
 * Retrieves the "message" event listener registered by the transport on
 * navigator.serviceWorker and invokes it with the given data.
 */
const fireInboundMessage = (data: unknown): void => {
    const calls = mockSwAddEventListener.mock.calls;
    const messageCall = calls.find(([event]: [string, any]) => event === "message");
    if (!messageCall) {
        throw new Error("No 'message' event listener was registered on navigator.serviceWorker");
    }
    const handler = messageCall[1] as (event: MessageEvent) => void;
    handler({ data } as MessageEvent);
};

/**
 * Installs a mock navigator.serviceWorker with the given controller value.
 */
const installMockNavigator = (controller: ServiceWorker | null): void => {
    (global as any).navigator = {
        serviceWorker: {
            controller,
            addEventListener: mockSwAddEventListener,
            removeEventListener: mockSwRemoveEventListener,
        },
    };
};

describe("createClientTransport", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset implementations so no stale mockImplementation leaks between tests.
        // clearAllMocks() does not reset implementations — only resetAllMocks() does,
        // but that's prohibited by the style guide for the outer beforeEach.
        mockSwAddEventListener.mockReset();
    });

    afterEach(() => {
        delete (global as any).navigator;
    });

    describe("when navigator.serviceWorker is not available", () => {
        let rejectedError: unknown;

        beforeEach(async () => {
            delete (global as any).navigator;
            try {
                await createClientTransport();
            } catch (err) {
                rejectedError = err;
            }
        });

        it("should reject with PostalServiceWorkerError", () => {
            expect(rejectedError).toBeInstanceOf(PostalServiceWorkerError);
        });

        it("should include a descriptive message about availability", () => {
            expect((rejectedError as PostalServiceWorkerError).message).toMatch(/not available/i);
        });
    });

    describe("when a controller is immediately available", () => {
        let transport: Transport;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should resolve with a transport object", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
        });

        it("should register a message listener on navigator.serviceWorker", () => {
            expect(mockSwAddEventListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when the controller is initially null and controllerchange fires", () => {
        let transport: Transport;

        beforeEach(async () => {
            installMockNavigator(null);

            // When addEventListener is called for "controllerchange", install a controller
            // and immediately fire the event to simulate the SW claiming the client.
            mockSwAddEventListener.mockImplementation((event: string, handler: () => void) => {
                if (event === "controllerchange") {
                    (global as any).navigator.serviceWorker.controller = {
                        postMessage: mockControllerPostMessage,
                    };
                    handler();
                }
            });

            transport = await createClientTransport({ timeout: 1000 });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should resolve with a transport", () => {
            expect(transport).toBeDefined();
        });
    });

    describe("when no controller appears before the timeout", () => {
        let rejectedError: unknown;

        beforeEach(async () => {
            jest.useFakeTimers();
            installMockNavigator(null);

            // Don't fire controllerchange — let the timeout expire
            mockSwAddEventListener.mockImplementation(() => {});

            const transportPromise = createClientTransport({ timeout: 2000 }).catch(err => {
                rejectedError = err;
            });

            jest.advanceTimersByTime(2001);
            await transportPromise;
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should reject with PostalServiceWorkerError", () => {
            expect(rejectedError).toBeInstanceOf(PostalServiceWorkerError);
        });

        it("should include a message about the timeout duration", () => {
            expect((rejectedError as PostalServiceWorkerError).message).toMatch(/2000ms/);
        });

        it("should include a mention of clients.claim()", () => {
            expect((rejectedError as PostalServiceWorkerError).message).toMatch(/clients\.claim/);
        });
    });

    describe("when send is called on an active transport", () => {
        let transport: Transport;
        let envelope: Envelope;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            envelope = makeEnvelope({ topic: "photon.torpedo.launch" });
            transport.send(envelope);
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should call postMessage on the controller once", () => {
            expect(mockControllerPostMessage).toHaveBeenCalledTimes(1);
        });

        it("should wrap the envelope in the postal:envelope protocol shape", () => {
            expect(mockControllerPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "postal:envelope",
                    envelope,
                })
            );
        });
    });

    describe("when send is called but the controller is null", () => {
        let transport: Transport;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            (global as any).navigator.serviceWorker.controller = null;
            transport.send(makeEnvelope());
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not call postMessage", () => {
            expect(mockControllerPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when send is called after dispose", () => {
        let transport: Transport;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            transport.dispose?.();
            transport.send(makeEnvelope());
        });

        it("should not call postMessage", () => {
            expect(mockControllerPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when an inbound postal:envelope message arrives", () => {
        let transport: Transport;
        let receivedEnvelope: Envelope;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            transport.subscribe(env => {
                receivedEnvelope = env;
            });
            const envelope = makeEnvelope({ topic: "shields.raised" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should deliver the envelope to the subscriber", () => {
            expect(receivedEnvelope).toEqual(expect.objectContaining({ topic: "shields.raised" }));
        });
    });

    describe("when a non-postal message arrives", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            callback = jest.fn();
            transport.subscribe(callback);
            fireInboundMessage({ random: "noise" });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not call the subscriber", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when a message arrives after dispose", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            callback = jest.fn();
            transport.subscribe(callback);
            transport.dispose?.();
            // removeEventListener is a no-op on the mock, so the listener still fires
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope: makeEnvelope() });
        });

        it("should not call the subscriber", () => {
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("when a subscriber unsubscribes", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            callback = jest.fn();
            const unsub = transport.subscribe(callback);
            unsub();
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope: makeEnvelope() });
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

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
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

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            transport.dispose?.();
        });

        it("should remove the message listener from navigator.serviceWorker", () => {
            expect(mockSwRemoveEventListener).toHaveBeenCalledWith("message", expect.any(Function));
        });

        describe("when subscribe is called after dispose", () => {
            let callback: jest.Mock;
            let returnedUnsub: () => void;

            beforeEach(() => {
                callback = jest.fn();
                returnedUnsub = transport.subscribe(callback);
                fireInboundMessage({
                    type: "postal:envelope",
                    version: 1,
                    envelope: makeEnvelope(),
                });
            });

            it("should return a callable no-op", () => {
                expect(() => returnedUnsub()).not.toThrow();
            });

            it("should not invoke the callback", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });

    describe("when dispose is called twice", () => {
        let transport: Transport;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            transport.dispose?.();
            transport.dispose?.();
        });

        it("should remove the listener only once", () => {
            expect(mockSwRemoveEventListener).toHaveBeenCalledTimes(1);
        });
    });

    describe("when one listener throws during message delivery", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(async () => {
            thrownError = new Error("E_WARP_CORE_BREACH");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();

            callbackA = jest.fn();
            callbackB = jest.fn().mockImplementation(() => {
                throw thrownError;
            });
            callbackC = jest.fn();
            transport.subscribe(callbackA);
            transport.subscribe(callbackB);
            transport.subscribe(callbackC);

            fireInboundMessage({
                type: "postal:envelope",
                version: 1,
                envelope: makeEnvelope({ topic: "red.alert" }),
            });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should still call the listeners before and after the throwing one", () => {
            expect(callbackA).toHaveBeenCalledTimes(1);
            expect(callbackC).toHaveBeenCalledTimes(1);
        });

        it("should re-throw the error via queueMicrotask", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            const fn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => fn()).toThrow(thrownError);
        });
    });

    describe("when a listener unsubscribes during iteration (snapshot safety)", () => {
        let transport: Transport;
        let callOrder: string[];

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();
            callOrder = [];

            let unsubB: (() => void) | undefined;

            transport.subscribe(() => {
                callOrder.push("A");
                unsubB?.();
            });

            unsubB = transport.subscribe(() => {
                callOrder.push("B");
            });

            fireInboundMessage({
                type: "postal:envelope",
                version: 1,
                envelope: makeEnvelope(),
            });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should still call B because the snapshot was taken before iteration", () => {
            expect(callOrder).toEqual(["A", "B"]);
        });
    });

    describe("when the controller is updated after transport creation (SW update)", () => {
        let transport: Transport;
        let newControllerPostMessage: jest.Mock;

        beforeEach(async () => {
            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();

            newControllerPostMessage = jest.fn();
            // Simulate SW update: navigator.serviceWorker.controller now points to a new SW
            (global as any).navigator.serviceWorker.controller = {
                postMessage: newControllerPostMessage,
            };

            transport.send(makeEnvelope({ topic: "app.updated" }));
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should use the new controller for sending", () => {
            expect(newControllerPostMessage).toHaveBeenCalledTimes(1);
        });

        it("should not use the old controller", () => {
            expect(mockControllerPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when navigator exists but navigator.serviceWorker is null", () => {
        let rejectedError: unknown;

        beforeEach(async () => {
            (global as any).navigator = { serviceWorker: null };
            try {
                await createClientTransport();
            } catch (err) {
                rejectedError = err;
            }
        });

        it("should reject with PostalServiceWorkerError", () => {
            expect(rejectedError).toBeInstanceOf(PostalServiceWorkerError);
        });
    });

    describe("PostalServiceWorkerError identity", () => {
        let error: PostalServiceWorkerError;

        beforeEach(() => {
            error = new PostalServiceWorkerError("boom");
        });

        it("should have name PostalServiceWorkerError", () => {
            expect(error.name).toBe("PostalServiceWorkerError");
        });

        it("should be an instance of Error", () => {
            expect(error).toBeInstanceOf(Error);
        });
    });

    describe("when controllerchange fires after the timeout has already settled", () => {
        let rejectedError: unknown;
        let lateControllerChangeHandler: (() => void) | null;

        beforeEach(async () => {
            jest.useFakeTimers();
            installMockNavigator(null);
            lateControllerChangeHandler = null;

            // Capture the controllerchange listener but do not fire it yet
            mockSwAddEventListener.mockImplementation((event: string, handler: () => void) => {
                if (event === "controllerchange") {
                    lateControllerChangeHandler = handler;
                }
            });

            const transportPromise = createClientTransport({ timeout: 500 }).catch(err => {
                rejectedError = err;
            });

            // Let the timeout fire first
            jest.advanceTimersByTime(501);
            await transportPromise;

            // Now fire the late controllerchange — should be a no-op (settled=true)
            if (lateControllerChangeHandler !== null) {
                (lateControllerChangeHandler as () => void)();
            }
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should reject exactly once via the timeout", () => {
            expect(rejectedError).toBeInstanceOf(PostalServiceWorkerError);
        });
    });

    describe("when two listeners both throw during message delivery", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;

        beforeEach(async () => {
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();

            transport.subscribe(
                jest.fn().mockImplementation(() => {
                    throw new Error("first");
                })
            );
            transport.subscribe(
                jest.fn().mockImplementation(() => {
                    throw new Error("second");
                })
            );

            fireInboundMessage({ type: "postal:envelope", version: 1, envelope: makeEnvelope() });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should schedule one deferred re-throw per throwing listener", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("when an inbound message arrives with a non-Error thrown by the listener", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let scheduledFn: () => void;

        beforeEach(async () => {
            queueMicrotaskSpy = jest.spyOn(globalThis, "queueMicrotask").mockImplementation(fn => {
                scheduledFn = fn;
            });

            installMockNavigator({ postMessage: mockControllerPostMessage } as any);
            transport = await createClientTransport();

            transport.subscribe(
                jest.fn().mockImplementation(() => {
                    throw "string-error";
                })
            );

            fireInboundMessage({ type: "postal:envelope", version: 1, envelope: makeEnvelope() });
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should still schedule the deferred re-throw", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
        });

        it("should re-throw the non-Error value as-is", () => {
            expect(() => scheduledFn()).toThrow("string-error");
        });
    });
});
