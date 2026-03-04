export default {};

import { connectToIframe, connectToParent } from "./iframe";
import { isSyn, isAck, createSyn, createAck } from "./protocol";
import { PostalHandshakeTimeoutError } from "./errors";

// --- Mock browser EventTarget on globalThis ---
// Node.js globalThis is not an EventTarget. In the browser, globalThis === window.
// We patch it here so connectToParent() can register listeners.

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
 * Creates a mock iframe whose contentWindow.postMessage captures
 * the transferred port and can simulate the child's ACK response.
 */
const createMockIframe = () => {
    let capturedPort: MessagePort | null = null;
    let capturedData: unknown = null;

    const iframe = {
        contentWindow: {
            postMessage: jest.fn((data: unknown, _origin: string, transfer?: unknown[]) => {
                capturedData = data;
                if (transfer && transfer.length > 0) {
                    capturedPort = transfer[0] as MessagePort;
                }
            }),
        },
    } as unknown as HTMLIFrameElement;

    return {
        iframe,
        getCapturedPort: () => capturedPort,
        getCapturedData: () => capturedData,
        ackFromChild: () => {
            if (!capturedPort) {
                throw new Error("No port captured — was connectToIframe called?");
            }
            capturedPort.postMessage(createAck());
        },
    };
};

/**
 * Simulates a parent window dispatching a SYN with a transferred port.
 * Node.js MessageEvent constructor doesn't support the `ports` init param,
 * so we use Object.defineProperty to attach them.
 */
const simulateParentSyn = (originValue = "http://parent.example.com") => {
    const channel = new MessageChannel();

    const event = new MessageEvent("message", {
        data: createSyn(),
        origin: originValue,
    });
    // Node.js MessageEvent doesn't support ports in the constructor
    Object.defineProperty(event, "ports", { value: [channel.port2] });

    globalThis.dispatchEvent(event);

    return { parentPort: channel.port1 };
};

describe("connectToIframe", () => {
    describe("when the iframe acknowledges the handshake", () => {
        it("should resolve with a Transport", async () => {
            const { iframe, ackFromChild } = createMockIframe();

            const promise = connectToIframe(iframe, { timeout: 1000 });
            ackFromChild();

            const transport = await promise;
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
            expect(typeof transport.dispose).toBe("function");
        });

        it("should send a SYN message to the iframe", async () => {
            const { iframe, ackFromChild, getCapturedData } = createMockIframe();

            const promise = connectToIframe(iframe, { timeout: 1000 });
            ackFromChild();
            await promise;

            expect(isSyn(getCapturedData())).toBe(true);
        });

        it("should transfer a port to the iframe", async () => {
            const { iframe, ackFromChild, getCapturedPort } = createMockIframe();

            const promise = connectToIframe(iframe, { timeout: 1000 });
            ackFromChild();
            await promise;

            expect(getCapturedPort()).toBeInstanceOf(MessagePort);
        });

        it("should pass targetOrigin to postMessage", async () => {
            const { iframe, ackFromChild } = createMockIframe();

            const promise = connectToIframe(iframe, {
                timeout: 1000,
                targetOrigin: "https://trusted.example.com",
            });
            ackFromChild();
            await promise;

            expect(iframe.contentWindow!.postMessage).toHaveBeenCalledWith(
                expect.anything(),
                "https://trusted.example.com",
                expect.any(Array)
            );
        });
    });

    describe("when the iframe does not respond", () => {
        it("should reject with PostalHandshakeTimeoutError", async () => {
            const { iframe } = createMockIframe();

            await expect(connectToIframe(iframe, { timeout: 50 })).rejects.toThrow(
                PostalHandshakeTimeoutError
            );
        });

        it("should include the timeout value on the error", async () => {
            const { iframe } = createMockIframe();

            const err = await connectToIframe(iframe, { timeout: 50 }).catch(e => e);
            expect(err).toBeInstanceOf(PostalHandshakeTimeoutError);
            expect((err as PostalHandshakeTimeoutError).timeout).toBe(50);
        });
    });

    describe("when the iframe contentWindow is null", () => {
        it("should reject with an error", async () => {
            const iframe = { contentWindow: null } as unknown as HTMLIFrameElement;

            await expect(connectToIframe(iframe, { timeout: 1000 })).rejects.toThrow(
                "iframe.contentWindow is null"
            );
        });
    });

    describe("when non-ACK messages arrive on the port", () => {
        it("should ignore them and keep waiting for the real ACK", async () => {
            const { iframe, getCapturedPort, ackFromChild } = createMockIframe();

            const promise = connectToIframe(iframe, { timeout: 1000 });

            const port = getCapturedPort()!;
            port.postMessage({ type: "not-postal" });
            port.postMessage("random string");

            ackFromChild();

            const transport = await promise;
            expect(transport).toBeDefined();
        });
    });
});

describe("connectToParent", () => {
    describe("when a SYN arrives from the parent", () => {
        it("should resolve with a Transport", async () => {
            const promise = connectToParent({ timeout: 1000 });
            simulateParentSyn();

            const transport = await promise;
            expect(transport).toBeDefined();
            expect(typeof transport.send).toBe("function");
            expect(typeof transport.subscribe).toBe("function");
        });

        it("should send an ACK back through the port", async () => {
            const promise = connectToParent({ timeout: 1000 });
            const { parentPort } = simulateParentSyn();

            await promise;

            const ackReceived = await new Promise<boolean>(resolve => {
                const timer = setTimeout(() => resolve(false), 500);
                parentPort.addEventListener("message", (event: MessageEvent) => {
                    if (isAck(event.data)) {
                        clearTimeout(timer);
                        resolve(true);
                    }
                });
                parentPort.start();
            });

            expect(ackReceived).toBe(true);
            parentPort.close();
        });
    });

    describe("when no SYN arrives", () => {
        it("should reject with PostalHandshakeTimeoutError", async () => {
            await expect(connectToParent({ timeout: 50 })).rejects.toThrow(
                PostalHandshakeTimeoutError
            );
        });
    });

    describe("when allowedOrigin is set and the SYN comes from a different origin", () => {
        it("should ignore the mismatched SYN and timeout", async () => {
            const promise = connectToParent({
                timeout: 100,
                allowedOrigin: "https://trusted.example.com",
            });

            simulateParentSyn("https://evil.example.com");

            await expect(promise).rejects.toThrow(PostalHandshakeTimeoutError);
        });
    });

    describe("when allowedOrigin is set and the SYN comes from the correct origin", () => {
        it("should accept the SYN and resolve", async () => {
            const promise = connectToParent({
                timeout: 1000,
                allowedOrigin: "https://trusted.example.com",
            });

            simulateParentSyn("https://trusted.example.com");

            const transport = await promise;
            expect(transport).toBeDefined();
        });
    });

    describe("when non-SYN messages arrive on globalThis", () => {
        it("should ignore them and keep waiting", async () => {
            const promise = connectToParent({ timeout: 1000 });

            globalThis.dispatchEvent(new MessageEvent("message", { data: { type: "not-postal" } }));
            globalThis.dispatchEvent(new MessageEvent("message", { data: "random" }));

            simulateParentSyn();

            const transport = await promise;
            expect(transport).toBeDefined();
        });
    });
});
