/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { EventEmitter } from "events";
import type { Envelope, Transport } from "postal";
import { createSocketTransport, type UdsSocket } from "./socketTransport";
import { createUdsEnvelopeMessage } from "./protocol";
import { ndjsonSerializer } from "./serialization";

// --- Mock socket helpers ---

const createMockSocket = () => {
    const emitter = new EventEmitter();
    const mockWrite = jest.fn();

    const socket = {
        write: mockWrite,
        on: (event: string, handler: (...args: any[]) => void) => {
            emitter.on(event, handler);
        },
        removeListener: (event: string, handler: (...args: any[]) => void) => {
            emitter.removeListener(event, handler);
        },
    } as unknown as UdsSocket;

    const emit = (event: string, ...args: any[]) => {
        emitter.emit(event, ...args);
    };

    return { socket, mockWrite, emit };
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

describe("createSocketTransport", () => {
    describe("send", () => {
        describe("when send is called with an envelope", () => {
            let mockWrite: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { socket, mockWrite: mw } = createMockSocket();
                mockWrite = mw;
                const transport = createSocketTransport(socket);
                envelope = makeEnvelope({ topic: "flux.capacitor.charged" });
                transport.send(envelope);
            });

            it("should call socket.write once", () => {
                expect(mockWrite).toHaveBeenCalledTimes(1);
            });

            it("should write NDJSON-encoded envelope message", () => {
                const expected = ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope));
                expect(mockWrite).toHaveBeenCalledWith(expected);
            });
        });

        describe("when send is called after dispose", () => {
            let mockWrite: jest.Mock;

            beforeEach(() => {
                const { socket, mockWrite: mw } = createMockSocket();
                mockWrite = mw;
                const transport = createSocketTransport(socket);
                transport.dispose?.();
                transport.send(makeEnvelope());
            });

            it("should not call socket.write", () => {
                expect(mockWrite).not.toHaveBeenCalled();
            });
        });
    });

    describe("subscribe", () => {
        describe("when an envelope message arrives as a complete chunk", () => {
            let callback: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envelope = makeEnvelope({ topic: "roads.not.needed" });
                emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope)));
            });

            it("should invoke the subscriber with the envelope", () => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback).toHaveBeenCalledWith(envelope);
            });
        });

        describe("when multiple subscribers are registered", () => {
            let callbackA: jest.Mock, callbackB: jest.Mock;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callbackA = jest.fn();
                callbackB = jest.fn();
                transport.subscribe(callbackA);
                transport.subscribe(callbackB);
                emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(makeEnvelope())));
            });

            it("should deliver to all subscribers", () => {
                expect(callbackA).toHaveBeenCalledTimes(1);
                expect(callbackB).toHaveBeenCalledTimes(1);
            });
        });

        describe("when a message is split across two data events (partial chunk buffering)", () => {
            let callback: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envelope = makeEnvelope({ topic: "eighty.eight.mph" });
                const encoded = ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope));
                // Split in the middle
                const midpoint = Math.floor(encoded.length / 2);
                emit("data", encoded.slice(0, midpoint));
                // No delivery yet — partial line
                expect(callback).not.toHaveBeenCalled();
                emit("data", encoded.slice(midpoint));
            });

            it("should deliver the envelope once the full line arrives", () => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback).toHaveBeenCalledWith(envelope);
            });
        });

        describe("when two messages arrive in a single data event (multi-message chunk)", () => {
            let callback: jest.Mock, envA: Envelope, envB: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envA = makeEnvelope({ topic: "marty.mcfly" });
                envB = makeEnvelope({ id: "env-2015", topic: "doc.brown" });
                const chunk =
                    ndjsonSerializer.encode(createUdsEnvelopeMessage(envA)) +
                    ndjsonSerializer.encode(createUdsEnvelopeMessage(envB));
                emit("data", chunk);
            });

            it("should deliver both envelopes", () => {
                expect(callback).toHaveBeenCalledTimes(2);
                expect(callback).toHaveBeenCalledWith(envA);
                expect(callback).toHaveBeenCalledWith(envB);
            });
        });

        describe("when inbound data is malformed", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                emit("data", "{broken json}\n");
                emit("data", "just a bare string\n");
                emit("data", '{"type":"not-postal"}\n');
                emit("data", '{"type":"postal:envelope"}\n'); // missing envelope field
            });

            it("should not invoke the subscriber", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("when a subscriber unsubscribes during delivery (snapshot iteration)", () => {
            let callbackA: jest.Mock, callbackC: jest.Mock;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callbackA = jest.fn();
                callbackC = jest.fn();

                let unsubC: (() => void) | undefined;

                transport.subscribe(callbackA);
                transport.subscribe(() => {
                    // B unsubscribes C mid-iteration — C must still be called
                    unsubC?.();
                });
                unsubC = transport.subscribe(callbackC);

                const envelope = makeEnvelope({ topic: "marty.time" });
                emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope)));
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
                capturedMicrotaskFn: (() => void) | undefined,
                callbackA: jest.Mock,
                callbackC: jest.Mock,
                thrownError: Error;

            beforeEach(() => {
                thrownError = new Error("E_WARP_CORE_BREACH");
                capturedMicrotaskFn = undefined;
                queueMicrotaskSpy = jest
                    .spyOn(globalThis, "queueMicrotask")
                    .mockImplementation((fn: () => void) => {
                        capturedMicrotaskFn = fn;
                    });

                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);

                callbackA = jest.fn();
                const callbackB = jest.fn().mockImplementation(() => {
                    throw thrownError;
                });
                callbackC = jest.fn();

                transport.subscribe(callbackA);
                transport.subscribe(callbackB);
                transport.subscribe(callbackC);

                emit(
                    "data",
                    ndjsonSerializer.encode(
                        createUdsEnvelopeMessage(makeEnvelope({ topic: "battle.stations" }))
                    )
                );
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
                expect(() => capturedMicrotaskFn!()).toThrow(thrownError);
            });
        });

        describe("when subscribe is called after dispose", () => {
            let callback: jest.Mock, unsub: () => void;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.dispose?.();
                unsub = transport.subscribe(callback);
                emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(makeEnvelope())));
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
                const { socket } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                const unsub = transport.subscribe(callback);
                unsub();
                unsub(); // second call should be a no-op
            });

            it("should not throw", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("when empty lines appear between messages", () => {
            let callback: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envelope = makeEnvelope({ topic: "mr.fusion" });
                // Two newlines between = one empty line (skipped), plus surrounding messages
                const chunk =
                    ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope)) +
                    "\n" + // extra empty line
                    ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope));
                emit("data", chunk);
            });

            it("should skip empty lines and deliver both envelopes", () => {
                expect(callback).toHaveBeenCalledTimes(2);
            });
        });

        describe("when rapid successive data events arrive", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);

                // Fire 10 messages in quick succession
                for (let i = 0; i < 10; i++) {
                    const env = makeEnvelope({ id: `env-${i}`, topic: `rapid.fire.${i}` });
                    emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(env)));
                }
            });

            it("should deliver all 10 envelopes", () => {
                expect(callback).toHaveBeenCalledTimes(10);
            });
        });

        describe("when a chunk contains complete messages with a trailing partial", () => {
            let callback: jest.Mock, envA: Envelope, envB: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envA = makeEnvelope({ topic: "hoverboard.gold" });
                envB = makeEnvelope({ id: "env-2015", topic: "almanac.sports" });

                const fullA = ndjsonSerializer.encode(createUdsEnvelopeMessage(envA));
                const fullB = ndjsonSerializer.encode(createUdsEnvelopeMessage(envB));
                const partialC = '{"type":"postal:envelope","version":1,"envelope":{"id":"env-par';

                // Two complete messages + a partial third
                emit("data", fullA + fullB + partialC);
            });

            it("should deliver the two complete envelopes immediately", () => {
                expect(callback).toHaveBeenCalledTimes(2);
                expect(callback).toHaveBeenCalledWith(envA);
                expect(callback).toHaveBeenCalledWith(envB);
            });
        });

        describe("when data arrives as a Buffer", () => {
            let callback: jest.Mock, envelope: Envelope;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                envelope = makeEnvelope({ topic: "gigawatts" });
                const encoded = ndjsonSerializer.encode(createUdsEnvelopeMessage(envelope));
                emit("data", Buffer.from(encoded, "utf-8"));
            });

            it("should decode and deliver the envelope", () => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback).toHaveBeenCalledWith(envelope);
            });
        });
    });

    describe("dispose", () => {
        describe("when dispose is called", () => {
            let socket: UdsSocket, transport: Transport;
            const removedListeners: any[] = [];

            beforeEach(() => {
                const mock = createMockSocket();
                socket = mock.socket;
                // Spy on removeListener
                const originalRemoveListener = socket.removeListener;
                socket.removeListener = jest.fn((...args: any[]) => {
                    removedListeners.push(args);
                    return (originalRemoveListener as any).apply(socket, args);
                }) as any;
                transport = createSocketTransport(socket);
                transport.dispose?.();
            });

            it("should call removeListener to detach the data handler", () => {
                expect(socket.removeListener).toHaveBeenCalledTimes(1);
                expect(socket.removeListener).toHaveBeenCalledWith("data", expect.any(Function));
            });
        });

        describe("when dispose is called twice (idempotent)", () => {
            let removeListenerMock: jest.Mock;

            beforeEach(() => {
                const { socket } = createMockSocket();
                removeListenerMock = jest.fn();
                socket.removeListener = removeListenerMock;
                const transport = createSocketTransport(socket);
                transport.dispose?.();
                transport.dispose?.();
            });

            it("should only call removeListener once", () => {
                expect(removeListenerMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("when dispose is called — socket lifecycle invariant", () => {
            let socket: UdsSocket;

            beforeEach(() => {
                const mock = createMockSocket();
                socket = mock.socket;
                (socket as any).destroy = jest.fn();
                (socket as any).end = jest.fn();
                const transport = createSocketTransport(socket);
                transport.dispose?.();
            });

            it("should NOT call socket.destroy", () => {
                expect((socket as any).destroy).not.toHaveBeenCalled();
            });

            it("should NOT call socket.end", () => {
                expect((socket as any).end).not.toHaveBeenCalled();
            });
        });

        describe("when data arrives after dispose", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const { socket, emit } = createMockSocket();
                const transport = createSocketTransport(socket);
                callback = jest.fn();
                transport.subscribe(callback);
                transport.dispose?.();
                emit("data", ndjsonSerializer.encode(createUdsEnvelopeMessage(makeEnvelope())));
            });

            it("should not invoke subscribers", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });
    });
});
