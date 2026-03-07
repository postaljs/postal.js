/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import type { ChildProcess } from "child_process";
import type { Transport } from "postal";
import { connectToChild, connectToParent } from "./child";
import { PostalHandshakeTimeoutError } from "./errors";
import { createSyn, createAck } from "./protocol";

// --- Mock ChildProcess helper ---

const createMockChild = (connected = true) => {
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

    const child = {
        connected,
        send: mockSend,
        on: mockOn,
        removeListener: mockRemoveListener,
    } as unknown as ChildProcess;

    const receive = (message: unknown): void => {
        const messageHandlers = handlers.get("message");
        if (messageHandlers) {
            for (const handler of messageHandlers) {
                handler(message);
            }
        }
    };

    return { child, mockSend, mockOn, mockRemoveListener, receive };
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

// --- connectToChild tests ---

describe("connectToChild", () => {
    describe("when the child acknowledges the handshake", () => {
        let transport: Transport, mockSend: jest.Mock;

        beforeEach(async () => {
            const { child, mockSend: ms, receive } = createMockChild(true);
            mockSend = ms;
            const promise = connectToChild(child, { timeout: 1000 });
            receive(createAck());
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should have sent a SYN to the child", () => {
            expect(mockSend).toHaveBeenCalledTimes(1);
            expect(mockSend).toHaveBeenCalledWith(createSyn());
        });
    });

    describe("when the child does not respond in time", () => {
        let error: unknown;

        beforeEach(async () => {
            const { child } = createMockChild(true);
            error = await connectToChild(child, { timeout: 30 }).catch(e => e);
        });

        it("should reject with PostalHandshakeTimeoutError", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });

        it("should include the timeout value on the error", () => {
            expect((error as PostalHandshakeTimeoutError).timeout).toBe(30);
        });
    });

    describe("when the child's IPC channel is not connected", () => {
        let error: unknown;

        beforeEach(async () => {
            const { child } = createMockChild(false);
            error = await connectToChild(child, { timeout: 1000 }).catch(e => e);
        });

        it("should reject with a descriptive error", () => {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toMatch(/IPC channel is not open/);
        });
    });

    describe("when non-ACK messages arrive before the real ACK", () => {
        let transport: Transport;

        beforeEach(async () => {
            const { child, receive } = createMockChild(true);
            const promise = connectToChild(child, { timeout: 1000 });
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
            const { child, mockRemoveListener: mrl } = createMockChild(true);
            mockRemoveListener = mrl;
            await connectToChild(child, { timeout: 30 }).catch(() => {});
        });

        it("should remove the message listener on timeout", () => {
            expect(mockRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });

    describe("when child.send() throws synchronously during the handshake", () => {
        let error: unknown, mockRemoveListener: jest.Mock;

        beforeEach(async () => {
            const { child, mockSend, mockRemoveListener: mrl } = createMockChild(true);
            mockRemoveListener = mrl;
            mockSend.mockImplementation(() => {
                throw new Error("E_IPC_CHANNEL_CLOSED");
            });
            error = await connectToChild(child, { timeout: 1000 }).catch(e => e);
        });

        it("should reject with the thrown error", () => {
            expect((error as Error).message).toBe("E_IPC_CHANNEL_CLOSED");
        });

        it("should remove the message listener before rejecting", () => {
            expect(mockRemoveListener).toHaveBeenCalledWith("message", expect.any(Function));
        });
    });
});

// --- connectToParent tests ---

describe("connectToParent", () => {
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

    describe("when the parent sends a SYN", () => {
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

            const promise = connectToParent({ timeout: 1000 });
            receive(createSyn());
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should have sent an ACK back to the parent", () => {
            expect(mockProcessSend).toHaveBeenCalledTimes(1);
            expect(mockProcessSend).toHaveBeenCalledWith(createAck());
        });
    });

    describe("when process has no IPC channel", () => {
        let error: unknown;

        beforeEach(async () => {
            // Remove process.send to simulate a non-forked process
            process.send = undefined as any;
            error = await connectToParent({ timeout: 1000 }).catch(e => e);
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

            error = await connectToParent({ timeout: 30 }).catch(e => e);
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

            const promise = connectToParent({ timeout: 1000 });
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

            await connectToParent({ timeout: 30 }).catch(() => {});
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

            const promise = connectToParent({ timeout: 1000 });
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
