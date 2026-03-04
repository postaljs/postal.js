export default {};

import { connectToWorker, connectToHost } from "./worker";
import { isSyn, isAck, createSyn, createAck } from "./protocol";
import { PostalHandshakeTimeoutError } from "./errors";

// --- Mock browser EventTarget on globalThis ---
// connectToHost() uses globalThis.addEventListener in the worker scope.

let eventTarget: EventTarget;

beforeEach(() => {
    eventTarget = new EventTarget();
    (globalThis as Record<string, unknown>).addEventListener =
        eventTarget.addEventListener.bind(eventTarget);
    (globalThis as Record<string, unknown>).removeEventListener =
        eventTarget.removeEventListener.bind(eventTarget);
    (globalThis as Record<string, unknown>).dispatchEvent =
        eventTarget.dispatchEvent.bind(eventTarget);
});

afterEach(() => {
    delete (globalThis as Record<string, unknown>).addEventListener;
    delete (globalThis as Record<string, unknown>).removeEventListener;
    delete (globalThis as Record<string, unknown>).dispatchEvent;
});

// --- Test helpers ---

/**
 * Creates a mock Worker whose postMessage captures the transferred port.
 */
const createMockWorker = () => {
    let capturedPort: MessagePort | null = null;
    let capturedData: unknown = null;

    const worker = {
        postMessage: jest.fn((data: unknown, transfer?: unknown[]) => {
            capturedData = data;
            if (transfer && transfer.length > 0) {
                capturedPort = transfer[0] as MessagePort;
            }
        }),
    } as unknown as Worker;

    return {
        worker,
        getCapturedPort: () => capturedPort,
        getCapturedData: () => capturedData,
        ackFromWorker: () => {
            if (!capturedPort) {
                throw new Error("No port captured — was connectToWorker called?");
            }
            capturedPort.postMessage(createAck());
        },
    };
};

/**
 * Simulates the host thread dispatching a SYN with a transferred port,
 * as connectToHost() would receive it inside a worker.
 */
const simulateHostSyn = () => {
    const channel = new MessageChannel();

    const event = new MessageEvent("message", {
        data: createSyn(),
    });
    Object.defineProperty(event, "ports", { value: [channel.port2] });

    globalThis.dispatchEvent(event);

    return { hostPort: channel.port1 };
};

describe("connectToWorker", () => {
    describe("when the worker acknowledges the handshake", () => {
        it("should resolve with a Transport", async () => {
            const { worker, ackFromWorker } = createMockWorker();

            const promise = connectToWorker(worker, { timeout: 1000 });
            ackFromWorker();

            const transport = await promise;
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should send a SYN message to the worker", async () => {
            const { worker, ackFromWorker, getCapturedData } = createMockWorker();

            const promise = connectToWorker(worker, { timeout: 1000 });
            ackFromWorker();
            await promise;

            expect(isSyn(getCapturedData())).toBe(true);
        });

        it("should transfer a port to the worker", async () => {
            const { worker, ackFromWorker, getCapturedPort } = createMockWorker();

            const promise = connectToWorker(worker, { timeout: 1000 });
            ackFromWorker();
            await promise;

            expect(getCapturedPort()).toBeInstanceOf(MessagePort);
        });
    });

    describe("when the worker does not respond", () => {
        it("should reject with PostalHandshakeTimeoutError", async () => {
            const { worker } = createMockWorker();

            await expect(connectToWorker(worker, { timeout: 50 })).rejects.toThrow(
                PostalHandshakeTimeoutError
            );
        });

        it("should include the timeout value on the error", async () => {
            const { worker } = createMockWorker();

            const err = await connectToWorker(worker, { timeout: 50 }).catch(e => e);
            expect(err).toBeInstanceOf(PostalHandshakeTimeoutError);
            expect((err as PostalHandshakeTimeoutError).timeout).toBe(50);
        });
    });

    describe("when non-ACK messages arrive on the port", () => {
        it("should ignore them and keep waiting for the real ACK", async () => {
            const { worker, getCapturedPort, ackFromWorker } = createMockWorker();

            const promise = connectToWorker(worker, { timeout: 1000 });

            const port = getCapturedPort()!;
            port.postMessage({ type: "not-postal" });

            ackFromWorker();

            const transport = await promise;
            expect(transport).toBeDefined();
        });
    });
});

describe("connectToHost", () => {
    describe("when a SYN arrives from the host", () => {
        it("should resolve with a Transport", async () => {
            const promise = connectToHost({ timeout: 1000 });
            simulateHostSyn();

            const transport = await promise;
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
        });

        it("should send an ACK back through the port", async () => {
            const promise = connectToHost({ timeout: 1000 });
            const { hostPort } = simulateHostSyn();

            await promise;

            const ackReceived = await new Promise<boolean>(resolve => {
                const timer = setTimeout(() => resolve(false), 500);
                hostPort.addEventListener("message", (event: MessageEvent) => {
                    if (isAck(event.data)) {
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
                hostPort.start();
            });

            expect(ackReceived).toBe(true);
            hostPort.close();
        });
    });

    describe("when no SYN arrives", () => {
        it("should reject with PostalHandshakeTimeoutError", async () => {
            await expect(connectToHost({ timeout: 50 })).rejects.toThrow(
                PostalHandshakeTimeoutError
            );
        });
    });

    describe("when non-SYN messages arrive on globalThis", () => {
        it("should ignore them and keep waiting", async () => {
            const promise = connectToHost({ timeout: 1000 });

            globalThis.dispatchEvent(new MessageEvent("message", { data: { type: "not-postal" } }));
            globalThis.dispatchEvent(new MessageEvent("message", { data: "random" }));

            simulateHostSyn();

            const transport = await promise;
            expect(transport).toBeDefined();
        });
    });
});
