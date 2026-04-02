/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { EventEmitter } from "events";
import * as net from "node:net";
import * as fs from "node:fs";
import { ndjsonSerializer } from "./serialization";
import { createUdsSyn, createUdsAck } from "./protocol";

// Mock postal's addTransport before importing server
const mockRemoveTransport = jest.fn();
jest.mock("postal", () => ({
    addTransport: jest.fn(() => mockRemoveTransport),
}));

// Import after mock setup
import { listenOnSocket } from "./server";
import { addTransport } from "postal";

// --- Mock helpers ---

const createMockClientSocket = () => {
    const emitter = new EventEmitter();
    const mockWrite = jest.fn();
    const mockDestroy = jest.fn();

    const socket = Object.assign(emitter, {
        write: mockWrite,
        destroy: mockDestroy,
    }) as unknown as net.Socket;

    return { socket, mockWrite, mockDestroy, emit: emitter.emit.bind(emitter) };
};

// We need to mock net.createServer to control connection events
let serverEmitter: EventEmitter;
let mockServerClose: jest.Mock;
let mockServerListen: jest.Mock;

jest.mock("node:net", () => {
    const actual = jest.requireActual("node:net");
    return {
        ...actual,
        createServer: jest.fn(() => {
            serverEmitter = new EventEmitter();
            mockServerClose = jest.fn();
            mockServerListen = jest.fn((_path: string, cb: () => void) => {
                cb();
            });
            return Object.assign(serverEmitter, {
                close: mockServerClose,
                listen: mockServerListen,
            });
        }),
    };
});

jest.mock("node:fs", () => ({
    unlinkSync: jest.fn(),
}));

describe("listenOnSocket", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (addTransport as jest.Mock).mockReturnValue(mockRemoveTransport);
    });

    describe("stale socket cleanup", () => {
        it("should attempt to unlink the socket path before listening", async () => {
            await listenOnSocket("/tmp/postal-test.sock");
            expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/postal-test.sock");
        });

        it("should handle ENOENT gracefully (no stale file)", async () => {
            (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
                const err: any = new Error("ENOENT");
                err.code = "ENOENT";
                throw err;
            });

            // Should not throw
            await expect(listenOnSocket("/tmp/postal-test.sock")).resolves.toBeDefined();
        });

        it("should re-throw non-ENOENT unlink errors (e.g. EACCES)", () => {
            (fs.unlinkSync as jest.Mock).mockImplementationOnce(() => {
                const err: any = new Error("EACCES: permission denied");
                err.code = "EACCES";
                throw err;
            });

            expect(() => listenOnSocket("/tmp/postal-test.sock")).toThrow(
                "EACCES: permission denied"
            );
        });

        it("should skip unlinking when unlinkStale is false", async () => {
            await listenOnSocket("/tmp/postal-test.sock", { unlinkStale: false });
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });
    });

    describe("handshake flow", () => {
        it("should send ACK and register transport when SYN is received", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client, mockWrite } = createMockClientSocket();

            // Simulate a client connection
            serverEmitter.emit("connection", client);

            // Client sends SYN
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            // Server should respond with ACK
            expect(mockWrite).toHaveBeenCalledTimes(1);
            const ackData = JSON.parse(mockWrite.mock.calls[0][0].trim());
            expect(ackData).toEqual(createUdsAck());

            // Transport should be registered
            expect(addTransport).toHaveBeenCalledTimes(1);

            dispose();
        });
    });

    describe("client disconnect cleanup", () => {
        it("should call removeTransport when a client socket closes", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            // Simulate disconnect
            client.emit("close");

            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);

            dispose();
        });
    });

    describe("dispose", () => {
        it("should close the server and destroy all client sockets", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client, mockDestroy } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            dispose();

            expect(mockServerClose).toHaveBeenCalledTimes(1);
            expect(mockDestroy).toHaveBeenCalledTimes(1);
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);
        });

        it("should be idempotent", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            dispose();
            dispose();

            expect(mockServerClose).toHaveBeenCalledTimes(1);
        });
    });

    describe("non-SYN messages during handshake", () => {
        it("should ignore non-SYN messages from a connecting client", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client, mockWrite } = createMockClientSocket();

            serverEmitter.emit("connection", client);

            // Send noise — not a SYN
            client.emit("data", ndjsonSerializer.encode({ type: "not-postal" }));
            client.emit("data", ndjsonSerializer.encode(createUdsAck()));

            // No ACK should have been sent (server only responds to SYN)
            expect(mockWrite).not.toHaveBeenCalled();
            expect(addTransport).not.toHaveBeenCalled();

            // Now send the real SYN — should complete handshake
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));
            expect(mockWrite).toHaveBeenCalledTimes(1);
            expect(addTransport).toHaveBeenCalledTimes(1);

            dispose();
        });
    });

    describe("multiple simultaneous clients", () => {
        it("should handle multiple clients connecting at the same time", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const clientA = createMockClientSocket();
            const clientB = createMockClientSocket();

            serverEmitter.emit("connection", clientA.socket);
            serverEmitter.emit("connection", clientB.socket);

            // Both send SYN
            clientA.socket.emit("data", ndjsonSerializer.encode(createUdsSyn()));
            clientB.socket.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            // Both should get ACK and have transports registered
            expect(clientA.mockWrite).toHaveBeenCalledTimes(1);
            expect(clientB.mockWrite).toHaveBeenCalledTimes(1);
            expect(addTransport).toHaveBeenCalledTimes(2);

            dispose();
        });
    });

    describe("client disconnect removes transport from map", () => {
        it("should call removeTransport on client error event", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            // Simulate error-based disconnect
            client.emit("error", new Error("EPIPE"));

            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);

            dispose();
        });

        it("should not double-remove if both close and error fire", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            client.emit("error", new Error("EPIPE"));
            client.emit("close");

            // removeTransport only on the first event — second is a no-op
            // because the entry is already deleted from the map
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);

            dispose();
        });
    });

    describe("connection after dispose", () => {
        it("should destroy the socket immediately if server is disposed", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            dispose();

            const { socket: client, mockDestroy } = createMockClientSocket();
            serverEmitter.emit("connection", client);

            expect(mockDestroy).toHaveBeenCalledTimes(1);
            expect(addTransport).not.toHaveBeenCalled();
        });
    });

    describe("post-startup error surfacing", () => {
        it("should re-throw server errors after startup via queueMicrotask", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");

            const thrown: Error[] = [];
            const originalQueueMicrotask = globalThis.queueMicrotask;
            globalThis.queueMicrotask = (fn: () => void) => {
                try {
                    fn();
                } catch (err) {
                    thrown.push(err as Error);
                }
            };

            try {
                const postStartupError = new Error("unexpected server error");
                serverEmitter.emit("error", postStartupError);

                expect(thrown).toHaveLength(1);
                expect(thrown[0]).toBe(postStartupError);
            } finally {
                globalThis.queueMicrotask = originalQueueMicrotask;
                dispose();
            }
        });
    });

    describe("version mismatch", () => {
        it("should destroy the socket when SYN has wrong version", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client, mockDestroy, mockWrite } = createMockClientSocket();

            serverEmitter.emit("connection", client);

            // Send SYN with wrong version
            client.emit("data", ndjsonSerializer.encode({ type: "postal:uds-syn", version: 999 }));

            expect(mockDestroy).toHaveBeenCalledTimes(1);
            expect(mockWrite).not.toHaveBeenCalled();
            expect(addTransport).not.toHaveBeenCalled();

            dispose();
        });
    });

    describe("handshake timeout", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should destroy the socket if SYN is not received within timeout", async () => {
            await listenOnSocket("/tmp/postal-test.sock", { timeout: 1000 });
            const { socket: client, mockDestroy } = createMockClientSocket();

            serverEmitter.emit("connection", client);

            // No SYN sent — advance past timeout
            jest.advanceTimersByTime(1001);

            expect(mockDestroy).toHaveBeenCalledTimes(1);
            expect(addTransport).not.toHaveBeenCalled();
        });
    });

    describe("duplicate SYN after handshake", () => {
        it("should ignore a second SYN once handshake is complete", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client, mockWrite } = createMockClientSocket();

            serverEmitter.emit("connection", client);

            // First SYN — completes handshake
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));
            expect(mockWrite).toHaveBeenCalledTimes(1);
            expect(addTransport).toHaveBeenCalledTimes(1);

            // Second SYN — should be ignored (data listener is removed)
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));
            expect(mockWrite).toHaveBeenCalledTimes(1);
            expect(addTransport).toHaveBeenCalledTimes(1);

            dispose();
        });
    });

    describe("filter pass-through", () => {
        it("should pass the filter option to addTransport", async () => {
            const filter = { channels: ["jobs"], topics: ["task.#"] };
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock", { filter });
            const { socket: client } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            expect(addTransport).toHaveBeenCalledWith(expect.any(Object), { filter });

            dispose();
        });

        it("should pass undefined filter when none is provided", async () => {
            const { dispose } = await listenOnSocket("/tmp/postal-test.sock");
            const { socket: client } = createMockClientSocket();

            serverEmitter.emit("connection", client);
            client.emit("data", ndjsonSerializer.encode(createUdsSyn()));

            expect(addTransport).toHaveBeenCalledWith(expect.any(Object), { filter: undefined });

            dispose();
        });
    });

    describe("startup error", () => {
        it("should reject the promise if the server emits an error before listening", async () => {
            // Reconfigure the mock so listen() doesn't auto-call the callback
            (net.createServer as jest.Mock).mockImplementationOnce(() => {
                serverEmitter = new EventEmitter();
                mockServerClose = jest.fn();
                mockServerListen = jest.fn(); // does NOT invoke callback
                return Object.assign(serverEmitter, {
                    close: mockServerClose,
                    listen: mockServerListen,
                });
            });

            const startupError = new Error("EADDRINUSE");
            const promise = listenOnSocket("/tmp/postal-test.sock");

            // Emit error before listen callback fires
            serverEmitter.emit("error", startupError);

            await expect(promise).rejects.toBe(startupError);
        });
    });
});
