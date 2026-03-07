/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { Worker as ClusterWorker } from "cluster";
import type { Transport } from "postal";
import { connectToClusterWorker, connectToClusterPrimary } from "./clusterHelpers";
import { PostalHandshakeTimeoutError } from "./errors";
import { createSyn, createAck } from "./protocol";

// --- Mock ClusterWorker helper ---

const createMockWorker = (connected = true) => {
    const handlers = new Map<string, Set<(message: unknown) => void>>();

    const mockSend = jest.fn();
    const mockIsConnected = jest.fn(() => connected);
    const mockOn = jest.fn((event: string, handler: (message: unknown) => void) => {
        if (!handlers.has(event)) {
            handlers.set(event, new Set());
        }
        handlers.get(event)!.add(handler);
    });
    const mockRemoveListener = jest.fn((event: string, handler: (message: unknown) => void) => {
        handlers.get(event)?.delete(handler);
    });

    const worker = {
        isConnected: mockIsConnected,
        send: mockSend,
        on: mockOn,
        removeListener: mockRemoveListener,
    } as unknown as ClusterWorker;

    const receive = (message: unknown): void => {
        const messageHandlers = handlers.get("message");
        if (messageHandlers) {
            for (const handler of messageHandlers) {
                handler(message);
            }
        }
    };

    return { worker, mockSend, mockOn, mockRemoveListener, mockIsConnected, receive };
};

// --- process mock helpers ---

const createProcessMock = (hasIPC: boolean) => {
    const handlers = new Map<string, Set<(message: unknown) => void>>();

    const mockProcessSend = hasIPC ? jest.fn() : undefined;
    const mockProcessOn = jest.fn((event: string, handler: (message: unknown) => void) => {
        if (!handlers.has(event)) {
            handlers.set(event, new Set());
        }
        handlers.get(event)!.add(handler);
    });
    const mockProcessRemoveListener = jest.fn(
        (event: string, handler: (message: unknown) => void) => {
            handlers.get(event)?.delete(handler);
        }
    );

    const receive = (message: unknown): void => {
        const messageHandlers = handlers.get("message");
        if (messageHandlers) {
            for (const handler of messageHandlers) {
                handler(message);
            }
        }
    };

    return { mockProcessSend, mockProcessOn, mockProcessRemoveListener, receive };
};

// --- connectToClusterWorker tests ---

describe("connectToClusterWorker", () => {
    describe("when the worker acknowledges the handshake", () => {
        let transport: Transport, mockSend: jest.Mock;

        beforeEach(async () => {
            const { worker, mockSend: ms, receive } = createMockWorker(true);
            mockSend = ms;
            const promise = connectToClusterWorker(worker, { timeout: 1000 });
            receive(createAck());
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should have sent a SYN to the worker", () => {
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith(createSyn());
        });
    });

    describe("when the worker does not respond in time", () => {
        let error: unknown;

        beforeEach(async () => {
            const { worker } = createMockWorker(true);
            error = await connectToClusterWorker(worker, { timeout: 30 }).catch(e => e);
        });

        it("should reject with PostalHandshakeTimeoutError", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });

        it("should include the timeout value on the error", () => {
            expect((error as PostalHandshakeTimeoutError).timeout).toBe(30);
        });
    });

    describe("when the worker's IPC channel is not connected", () => {
        let error: unknown;

        beforeEach(async () => {
            const { worker } = createMockWorker(false);
            error = await connectToClusterWorker(worker, { timeout: 1000 }).catch(e => e);
        });

        it("should reject with a descriptive error", () => {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/IPC channel is not open/);
        });
    });

    describe("when non-ACK messages arrive before the real ACK", () => {
        let transport: Transport;

        beforeEach(async () => {
            const { worker, receive } = createMockWorker(true);
            const promise = connectToClusterWorker(worker, { timeout: 1000 });
            receive({ type: "not-postal" });
            receive("random noise");
            receive(createAck());
            transport = await promise;
        });

        it("should still resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });
    });

    describe("when the handshake listener is cleaned up after timeout", () => {
        let mockRemoveListener: jest.Mock;

        beforeEach(async () => {
            const { worker, mockRemoveListener: mrl } = createMockWorker(true);
            mockRemoveListener = mrl;
            await connectToClusterWorker(worker, { timeout: 30 }).catch(() => {});
        });

        it("should remove the message listener on timeout", () => {
            expect(mockRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when worker.send() throws synchronously during the handshake", () => {
        let error: unknown, mockRemoveListener: jest.Mock;

        beforeEach(async () => {
            const { worker, mockSend, mockRemoveListener: mrl } = createMockWorker(true);
            mockRemoveListener = mrl;
            mockSend.mockImplementation(() => {
                throw new Error("E_WORKER_CHANNEL_GONE");
            });
            error = await connectToClusterWorker(worker, { timeout: 1000 }).catch(e => e);
        });

        it("should reject with the thrown error", () => {
            expect((error as Error).message).toBe("E_WORKER_CHANNEL_GONE");
        });

        it("should remove the message listener before rejecting", () => {
            expect(mockRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });
});

// --- connectToClusterPrimary tests ---

describe("connectToClusterPrimary", () => {
    let originalProcessSend: typeof process.send;
    let originalProcessOn: typeof process.on;
    let originalProcessRemoveListener: typeof process.removeListener;

    beforeEach(() => {
        originalProcessSend = process.send;
        originalProcessOn = process.on;
        originalProcessRemoveListener = process.removeListener;
    });

    afterEach(() => {
        process.send = originalProcessSend;
        process.on = originalProcessOn as typeof process.on;
        process.removeListener = originalProcessRemoveListener as typeof process.removeListener;
    });

    describe("when the primary sends a SYN", () => {
        let transport: Transport, mockProcessSend: jest.Mock;

        beforeEach(async () => {
            const {
                mockProcessSend: mps,
                mockProcessOn,
                mockProcessRemoveListener,
                receive,
            } = createProcessMock(true);
            mockProcessSend = mps!;

            process.send = mockProcessSend as any;
            process.on = mockProcessOn as any;
            process.removeListener = mockProcessRemoveListener as any;

            const promise = connectToClusterPrimary({ timeout: 1000 });
            receive(createSyn());
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should have sent an ACK back to the primary", () => {
            expect(mockProcessSend).toHaveBeenCalledTimes(1);
            expect(mockProcessSend).toHaveBeenCalledWith(createAck());
        });
    });

    describe("when process has no IPC channel", () => {
        let error: unknown;

        beforeEach(async () => {
            process.send = undefined as any;
            error = await connectToClusterPrimary({ timeout: 1000 }).catch(e => e);
        });

        it("should reject immediately with a descriptive error", () => {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/IPC channel/);
        });
    });

    describe("when no SYN arrives before timeout", () => {
        let error: unknown;

        beforeEach(async () => {
            const { mockProcessSend, mockProcessOn, mockProcessRemoveListener } =
                createProcessMock(true);

            process.send = mockProcessSend as any;
            process.on = mockProcessOn as any;
            process.removeListener = mockProcessRemoveListener as any;

            error = await connectToClusterPrimary({ timeout: 30 }).catch(e => e);
        });

        it("should reject with PostalHandshakeTimeoutError", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });

        it("should include the timeout value on the error", () => {
            expect((error as PostalHandshakeTimeoutError).timeout).toBe(30);
        });
    });

    describe("when non-SYN messages arrive before the real SYN", () => {
        let transport: Transport;

        beforeEach(async () => {
            const { mockProcessSend, mockProcessOn, mockProcessRemoveListener, receive } =
                createProcessMock(true);

            process.send = mockProcessSend as any;
            process.on = mockProcessOn as any;
            process.removeListener = mockProcessRemoveListener as any;

            const promise = connectToClusterPrimary({ timeout: 1000 });
            receive({ type: "not-postal" });
            receive("random string");
            receive(createSyn());
            transport = await promise;
        });

        it("should still resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });
    });

    describe("when the handshake listener is cleaned up after timeout", () => {
        let mockProcessRemoveListener: jest.Mock;

        beforeEach(async () => {
            const {
                mockProcessSend,
                mockProcessOn,
                mockProcessRemoveListener: mprl,
            } = createProcessMock(true);
            mockProcessRemoveListener = mprl;

            process.send = mockProcessSend as any;
            process.on = mockProcessOn as any;
            process.removeListener = mockProcessRemoveListener as any;

            await connectToClusterPrimary({ timeout: 30 }).catch(() => {});
        });

        it("should remove the message listener on timeout", () => {
            expect(mockProcessRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when process.send becomes undefined between the IPC guard and the SYN callback", () => {
        let transport: Transport, mockProcessSend: jest.Mock;

        beforeEach(async () => {
            const {
                mockProcessSend: mps,
                mockProcessOn,
                mockProcessRemoveListener,
                receive,
            } = createProcessMock(true);
            mockProcessSend = mps!;

            process.send = mockProcessSend as any;
            process.on = mockProcessOn as any;
            process.removeListener = mockProcessRemoveListener as any;

            const promise = connectToClusterPrimary({ timeout: 1000 });
            // Simulate IPC disconnect just before the SYN callback fires
            process.send = undefined as any;
            receive(createSyn());
            transport = await promise;
        });

        it("should still resolve with a Transport", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
        });

        it("should not call process.send with an ACK", () => {
            expect(mockProcessSend).not.toHaveBeenCalled();
        });
    });
});
