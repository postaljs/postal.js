/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { connectToWorkerThread, connectFromWorkerThread } from "./worker-thread";
import { isSyn, isAck, createSyn, createAck } from "./protocol";
import { PostalHandshakeTimeoutError } from "./errors";
import type { Transport } from "postal";

// --- Mock node:worker_threads ---
//
// parentPort is controlled via a module-level variable read through the mock
// getter. We use real MessageChannel from Node for actual port transfers.
// This mirrors how worker.test.ts mocks globalThis without resetting modules.

// Captures the onSyn handler registered by connectFromWorkerThread so
// simulateParentSyn can invoke it directly instead of scanning mock calls.
let capturedOnSyn: ((event: MessageEvent) => void) | null = null;

const mockParentPortAddEventListener = jest.fn((type: string, handler: any) => {
    if (type === "message") {
        capturedOnSyn = handler;
    }
});
const mockParentPortRemoveEventListener = jest.fn();
const mockParentPortStart = jest.fn();
const mockParentPortPostMessage = jest.fn();

const mockParentPort = {
    addEventListener: mockParentPortAddEventListener,
    removeEventListener: mockParentPortRemoveEventListener,
    start: mockParentPortStart,
    postMessage: mockParentPortPostMessage,
};

let currentParentPort: typeof mockParentPort | null = null;

jest.mock("node:worker_threads", () => ({
    // Real MessageChannel so port transfers work correctly in tests
    MessageChannel: jest.requireActual("node:worker_threads").MessageChannel,
    get parentPort() {
        return currentParentPort;
    },
}));

// --- Test helpers ---

/**
 * Creates a mock NodeWorker whose postMessage captures the transferred port
 * and the data payload.
 */
const createMockNodeWorker = () => {
    let capturedPort: MessagePort | null = null;
    let capturedData: unknown = null;

    const worker = {
        postMessage: jest.fn((data: unknown, transfer?: unknown[]) => {
            capturedData = data;
            if (transfer && transfer.length > 0) {
                capturedPort = transfer[0] as MessagePort;
            }
        }),
    } as any;

    return {
        worker,
        getCapturedPort: () => capturedPort,
        getCapturedData: () => capturedData,
        ackFromWorker: () => {
            if (!capturedPort) {
                throw new Error("No port captured — was connectToWorkerThread called?");
            }
            capturedPort.postMessage(createAck());
        },
    };
};

/**
 * Simulates the parent thread dispatching a SYN with a transferred port on
 * the mock parentPort, as connectFromWorkerThread() would receive it.
 * Returns the host-side port so tests can assert ACK arrival.
 */
const simulateParentSyn = () => {
    const { MessageChannel: NodeMessageChannel } = jest.requireActual("node:worker_threads");
    const channel = new NodeMessageChannel();

    const event = new MessageEvent("message", {
        data: createSyn(),
    });
    // event.ports is read-only — override via defineProperty
    Object.defineProperty(event, "ports", { value: [channel.port2] });

    if (capturedOnSyn) {
        capturedOnSyn(event);
    }

    return { hostPort: channel.port1 };
};

// --- Test suites ---

describe("connectToWorkerThread", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("when the worker acknowledges the handshake", () => {
        let transport: Transport;

        beforeEach(async () => {
            const { worker, ackFromWorker } = createMockNodeWorker();
            const promise = connectToWorkerThread(worker, { timeout: 1000 });
            ackFromWorker();
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });

        it("should expose send, subscribe, and dispose methods", () => {
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });
    });

    describe("when the worker acknowledges (SYN and port transfer verification)", () => {
        let getCapturedData: () => unknown, getCapturedPort: () => MessagePort | null;

        beforeEach(async () => {
            const mock = createMockNodeWorker();
            getCapturedData = mock.getCapturedData;
            getCapturedPort = mock.getCapturedPort;

            const promise = connectToWorkerThread(mock.worker, { timeout: 1000 });
            mock.ackFromWorker();
            await promise;
        });

        it("should send a SYN message to the worker", () => {
            expect(isSyn(getCapturedData())).toBe(true);
        });

        it("should transfer a MessagePort to the worker", () => {
            const { MessagePort: NodeMessagePort } = jest.requireActual("node:worker_threads");
            expect(getCapturedPort()).toBeInstanceOf(NodeMessagePort);
        });
    });

    describe("when the worker does not respond in time", () => {
        let error: unknown;

        beforeEach(async () => {
            const { worker } = createMockNodeWorker();
            error = await connectToWorkerThread(worker, { timeout: 50 }).catch(e => e);
        });

        it("should reject with PostalHandshakeTimeoutError", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });

        it("should include the timeout value on the error", () => {
            expect((error as PostalHandshakeTimeoutError).timeout).toBe(50);
        });
    });

    describe("when non-ACK messages arrive before the real ACK", () => {
        let transport: Transport;

        beforeEach(async () => {
            const { worker, getCapturedPort, ackFromWorker } = createMockNodeWorker();
            const promise = connectToWorkerThread(worker, { timeout: 1000 });

            // Fire noise on the port before the real ACK
            const port = getCapturedPort()!;
            port.postMessage({ type: "not-postal" });
            port.postMessage("just chatting");

            ackFromWorker();
            transport = await promise;
        });

        it("should ignore them and resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });
    });
});

describe("connectFromWorkerThread", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        capturedOnSyn = null;
        // Default to null — each scenario sets it as needed
        currentParentPort = null;
    });

    describe("when called outside a worker thread (parentPort is null)", () => {
        let error: unknown;

        beforeEach(async () => {
            // currentParentPort is null — simulates main thread
            error = await connectFromWorkerThread({ timeout: 1000 }).catch(e => e);
        });

        it("should reject with an Error", () => {
            expect(error).toBeInstanceOf(Error);
        });

        it("should mention 'Worker thread' in the error message", () => {
            expect((error as Error).message).toMatch(/Worker thread/i);
        });
    });

    describe("when a SYN arrives from the parent thread", () => {
        let transport: Transport;

        beforeEach(async () => {
            currentParentPort = mockParentPort as any;

            const promise = connectFromWorkerThread({ timeout: 1000 });
            simulateParentSyn();
            transport = await promise;
        });

        it("should resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });

        it("should expose send, subscribe, and dispose methods", () => {
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should NOT call start() on parentPort (shared channel, not ours to start)", () => {
            expect(mockParentPortStart).not.toHaveBeenCalled();
        });
    });

    describe("when the SYN arrives (ACK verification)", () => {
        let ackReceived: boolean;

        beforeEach(async () => {
            currentParentPort = mockParentPort as any;

            const promise = connectFromWorkerThread({ timeout: 1000 });
            const { hostPort } = simulateParentSyn();
            await promise;

            // Verify an ACK was sent back through the transferred port
            ackReceived = await new Promise<boolean>(resolve => {
                const timer = setTimeout(() => resolve(false), 500);
                hostPort.addEventListener("message", (event: MessageEvent) => {
                    if (isAck(event.data)) {
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
                hostPort.start();
            });
        });

        it("should send ACK back through the received port", () => {
            expect(ackReceived).toBe(true);
        });
    });

    describe("when the parent thread does not send a SYN in time", () => {
        let error: unknown;

        beforeEach(async () => {
            currentParentPort = mockParentPort as any;

            error = await connectFromWorkerThread({ timeout: 50 }).catch(e => e);
        });

        it("should reject with PostalHandshakeTimeoutError", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });

        it("should include the timeout value on the error", () => {
            expect((error as PostalHandshakeTimeoutError).timeout).toBe(50);
        });
    });

    describe("when non-SYN messages arrive before the real SYN", () => {
        let transport: Transport;

        beforeEach(async () => {
            currentParentPort = mockParentPort as any;

            const promise = connectFromWorkerThread({ timeout: 1000 });

            // Fire noise through the captured listener before the real SYN
            expect(capturedOnSyn).not.toBeNull();
            capturedOnSyn!(new MessageEvent("message", { data: { type: "not-postal" } }));
            capturedOnSyn!(new MessageEvent("message", { data: "beep boop" }));

            simulateParentSyn();
            transport = await promise;
        });

        it("should ignore them and resolve with a Transport", () => {
            expect(transport).toBeDefined();
        });
    });

    describe("when a SYN arrives but carries no transferred port", () => {
        let error: unknown;

        beforeEach(async () => {
            currentParentPort = mockParentPort as any;

            // Start waiting with a short timeout so the test doesn't hang
            const promise = connectFromWorkerThread({ timeout: 50 }).catch(e => e);

            // Dispatch a valid SYN but with an empty ports array — hits the
            // isSyn(event.data) && event.ports.length > 0 branch where the
            // length check fails, so the message is silently ignored
            const synWithNoPort = new MessageEvent("message", { data: createSyn() });
            Object.defineProperty(synWithNoPort, "ports", { value: [] });
            expect(capturedOnSyn).not.toBeNull();
            capturedOnSyn!(synWithNoPort);

            error = await promise;
        });

        it("should not resolve — the portless SYN is ignored and the handshake times out", () => {
            expect(error).toBeInstanceOf(PostalHandshakeTimeoutError);
        });
    });
});
