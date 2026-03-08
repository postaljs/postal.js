/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { Envelope, Transport } from "postal";

// --- Mock setup ---
// SW globals (self.addEventListener, self.clients) are assigned to globalThis before each test.

const mockSelfAddEventListener = jest.fn();
const mockSelfRemoveEventListener = jest.fn();
const mockClientPostMessage = jest.fn();
const mockClientsMatchAll = jest.fn();

// --- Helpers ---

const makeEnvelope = (overrides: Partial<Envelope> = {}): Envelope => ({
    id: "env-DS9-001",
    type: "publish",
    channel: "bajor",
    topic: "prophets.speaking",
    payload: { emissary: "Sisko" },
    timestamp: 2369000000000,
    ...overrides,
});

const makeClient = (id: string): { id: string; postMessage: jest.Mock } => ({
    id,
    postMessage: mockClientPostMessage,
});

/**
 * Retrieves the "message" event listener registered by the transport on
 * the SW global self and invokes it with the given data.
 * This simulates an inbound message arriving from a client.
 */
const fireInboundMessage = (data: unknown, sourceId?: string): void => {
    const calls = mockSelfAddEventListener.mock.calls;
    const messageCall = calls.find(([event]: [string, any]) => event === "message");
    if (!messageCall) {
        throw new Error("No 'message' event listener was registered on self");
    }
    const handler = messageCall[1] as (event: ExtendableMessageEvent) => void;
    handler({
        data,
        source: sourceId ? { id: sourceId } : null,
    } as unknown as ExtendableMessageEvent);
};

/**
 * Installs SW-like globals on globalThis.
 */
const installSwGlobals = (): void => {
    (global as any).self = {
        addEventListener: mockSelfAddEventListener,
        removeEventListener: mockSelfRemoveEventListener,
        clients: {
            matchAll: mockClientsMatchAll,
        },
    };
};

describe("createServiceWorkerTransport", () => {
    let createServiceWorkerTransport: typeof import("./serviceWorkerTransport").createServiceWorkerTransport;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
        installSwGlobals();
    });

    afterEach(() => {
        delete (global as any).self;
    });

    describe("when creating a transport with default options", () => {
        let transport: Transport;

        beforeEach(async () => {
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should register a message listener on self", () => {
            expect(mockSelfAddEventListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when an inbound postal:envelope message arrives", () => {
        let transport: Transport;
        let receivedEnvelope: Envelope;

        beforeEach(async () => {
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.subscribe(env => {
                receivedEnvelope = env;
            });
            const envelope = makeEnvelope({ topic: "cardassians.detected" });
            fireInboundMessage({ type: "postal:envelope", version: 1, envelope });
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should deliver the envelope to the subscriber", () => {
            expect(receivedEnvelope).toEqual(
                expect.objectContaining({ topic: "cardassians.detected" })
            );
        });
    });

    describe("when a non-postal message arrives", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(async () => {
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
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

    describe("when send is called and clients are available", () => {
        let transport: Transport;
        let envelope: Envelope;
        let clientA: ReturnType<typeof makeClient>, clientB: ReturnType<typeof makeClient>;

        beforeEach(async () => {
            clientA = makeClient("client-a");
            clientB = makeClient("client-b");
            mockClientsMatchAll.mockResolvedValue([clientA, clientB]);

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            envelope = makeEnvelope({ topic: "bajoran.wormhole.open" });
            transport.send(envelope);

            // Drain the microtask queue so the matchAll promise resolves
            await Promise.resolve();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should call matchAll with default options", () => {
            expect(mockClientsMatchAll).toHaveBeenCalledWith({
                type: "window",
                includeUncontrolled: false,
            });
        });

        it("should fan out to all clients", () => {
            expect(mockClientPostMessage).toHaveBeenCalledTimes(2);
        });

        it("should send the envelope in the postal:envelope protocol shape", () => {
            expect(mockClientPostMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "postal:envelope",
                    envelope,
                })
            );
        });
    });

    describe("when send is called with custom clientMatchOptions", () => {
        let transport: Transport;

        beforeEach(async () => {
            mockClientsMatchAll.mockResolvedValue([]);
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport({
                clientMatchOptions: { type: "window", includeUncontrolled: true },
            });
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should forward the custom options to matchAll", () => {
            expect(mockClientsMatchAll).toHaveBeenCalledWith({
                type: "window",
                includeUncontrolled: true,
            });
        });
    });

    describe("when send is called with no connected clients", () => {
        let transport: Transport;

        beforeEach(async () => {
            mockClientsMatchAll.mockResolvedValue([]);
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should not call postMessage on any client", () => {
            expect(mockClientPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when the originating client should be excluded from fan-out", () => {
        let transport: Transport;
        const senderClientId = "client-quark";
        const otherClientId = "client-odo";

        let senderPostMessage: jest.Mock, otherPostMessage: jest.Mock;

        beforeEach(async () => {
            senderPostMessage = jest.fn();
            otherPostMessage = jest.fn();

            // The transport does NOT automatically exclude by sourceClientId on send —
            // that exclusion is done at the postal core level via the source field.
            // The SW transport fans out to ALL clients; echo prevention is postal's job.
            // This test verifies the fan-out reaches both clients.
            mockClientsMatchAll.mockResolvedValue([
                { id: senderClientId, postMessage: senderPostMessage },
                { id: otherClientId, postMessage: otherPostMessage },
            ]);

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.send(makeEnvelope({ topic: "latinum.exchange" }));

            await Promise.resolve();
        });

        afterEach(() => {
            transport.dispose?.();
        });

        it("should post to the other client", () => {
            expect(otherPostMessage).toHaveBeenCalledTimes(1);
        });

        it("should also post to sender (echo prevention is postal core's responsibility)", () => {
            // The SW transport fans out to all matched clients. The postal core
            // uses source/instanceId to suppress echoes at the subscriber level.
            expect(senderPostMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe("when send is called after dispose", () => {
        let transport: Transport;

        beforeEach(async () => {
            mockClientsMatchAll.mockResolvedValue([makeClient("client-x")]);
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.dispose?.();
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        it("should not call matchAll", () => {
            expect(mockClientsMatchAll).not.toHaveBeenCalled();
        });
    });

    describe("when dispose is called", () => {
        let transport: Transport;

        beforeEach(async () => {
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.dispose?.();
        });

        it("should remove the message listener from self", () => {
            expect(mockSelfRemoveEventListener).toHaveBeenCalledWith(
                "message",
                expect.any(Function)
            );
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
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.dispose?.();
            transport.dispose?.();
        });

        it("should remove the listener only once", () => {
            expect(mockSelfRemoveEventListener).toHaveBeenCalledTimes(1);
        });
    });

    describe("when a message arrives after dispose", () => {
        let transport: Transport;
        let callback: jest.Mock;

        beforeEach(async () => {
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            callback = jest.fn();
            transport.subscribe(callback);
            transport.dispose?.();
            // removeEventListener is a no-op on the mock, listener still fires
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
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
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
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
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

    describe("when one listener throws during message delivery", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;
        let thrownError: Error;

        beforeEach(async () => {
            thrownError = new Error("E_REPLICATOR_MALFUNCTION");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();

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
                envelope: makeEnvelope({ topic: "systems.overload" }),
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
            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
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

    describe("when matchAll rejects during fan-out", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let matchAllError: Error;

        beforeEach(async () => {
            matchAllError = new Error("E_CLIENTS_UNAVAILABLE");
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});
            mockClientsMatchAll.mockRejectedValue(matchAllError);

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should re-throw the error via queueMicrotask", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            const fn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => fn()).toThrow(matchAllError);
        });
    });

    describe("when dispose is called between send() and the matchAll resolution (race)", () => {
        let transport: Transport;
        let resolveMatchAll: (clients: ReturnType<typeof makeClient>[]) => void;

        beforeEach(async () => {
            // Hold the matchAll promise open so we can dispose before it resolves
            mockClientsMatchAll.mockReturnValue(
                new Promise<ReturnType<typeof makeClient>[]>(res => {
                    resolveMatchAll = res;
                })
            );

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();

            // send() fires, matchAll is pending
            transport.send(makeEnvelope());

            // dispose while matchAll is still pending
            transport.dispose?.();

            // Now resolve matchAll — the .then() handler should see disposed=true and bail
            resolveMatchAll([makeClient("client-x")]);
            await Promise.resolve();
        });

        it("should not post to any client after dispose", () => {
            expect(mockClientPostMessage).not.toHaveBeenCalled();
        });
    });

    describe("when client.postMessage throws during fan-out", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let throwingClientPostMessage: jest.Mock;
        let safeClientPostMessage: jest.Mock;
        let postMessageError: Error;

        beforeEach(async () => {
            postMessageError = new Error("E_POSTMESSAGE_FAILED");
            throwingClientPostMessage = jest.fn().mockImplementation(() => {
                throw postMessageError;
            });
            safeClientPostMessage = jest.fn();

            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            mockClientsMatchAll.mockResolvedValue([
                { id: "client-throws", postMessage: throwingClientPostMessage },
                { id: "client-safe", postMessage: safeClientPostMessage },
            ]);

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should schedule the postMessage error via queueMicrotask (caught by per-client try/catch)", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
            const fn = queueMicrotaskSpy.mock.calls[0][0] as () => void;
            expect(() => fn()).toThrow(postMessageError);
        });

        it("should still deliver to clients after the throwing one (loop continues)", () => {
            // Per-client try/catch ensures a stale/bad client doesn't abort
            // delivery to the remaining clients in the fan-out loop.
            expect(safeClientPostMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe("when matchAll rejects with a non-Error value", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;
        let scheduledFn: () => void;

        beforeEach(async () => {
            queueMicrotaskSpy = jest.spyOn(globalThis, "queueMicrotask").mockImplementation(fn => {
                scheduledFn = fn;
            });
            mockClientsMatchAll.mockRejectedValue("string-rejection");

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();
            transport.send(makeEnvelope());

            await Promise.resolve();
        });

        afterEach(() => {
            queueMicrotaskSpy.mockRestore();
            transport.dispose?.();
        });

        it("should schedule a deferred re-throw for the non-Error rejection value", () => {
            expect(queueMicrotaskSpy).toHaveBeenCalledTimes(1);
        });

        it("should re-throw the non-Error value as-is", () => {
            expect(() => scheduledFn()).toThrow("string-rejection");
        });
    });

    describe("when two listeners both throw during message delivery", () => {
        let transport: Transport;
        let queueMicrotaskSpy: jest.SpyInstance;

        beforeEach(async () => {
            queueMicrotaskSpy = jest
                .spyOn(globalThis, "queueMicrotask")
                .mockImplementation(() => {});

            ({ createServiceWorkerTransport } = await import("./serviceWorkerTransport"));
            transport = createServiceWorkerTransport();

            transport.subscribe(
                jest.fn().mockImplementation(() => {
                    throw new Error("err-1");
                })
            );
            transport.subscribe(
                jest.fn().mockImplementation(() => {
                    throw new Error("err-2");
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
});
