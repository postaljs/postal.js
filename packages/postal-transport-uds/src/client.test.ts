/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { EventEmitter } from "events";
// net is mocked below — import kept for type reference only
import { ndjsonSerializer } from "./serialization";
import { createUdsSyn, createUdsAck, PROTOCOL_VERSION } from "./protocol";
import { PostalUdsHandshakeTimeoutError, PostalUdsVersionMismatchError } from "./errors";

// Mock postal's addTransport
const mockRemoveTransport = jest.fn();
jest.mock("postal", () => ({
    addTransport: jest.fn(() => mockRemoveTransport),
}));

import { connectToSocket } from "./client";
import { addTransport } from "postal";

// --- Mock socket ---

let mockSocket: EventEmitter & {
    write: jest.Mock;
    destroy: jest.Mock;
    removeListener: any;
};

jest.mock("node:net", () => {
    const actual = jest.requireActual("node:net");
    return {
        ...actual,
        connect: jest.fn((_path: string) => {
            const emitter = new EventEmitter();
            const mockWrite = jest.fn();
            const mockDestroy = jest.fn();
            mockSocket = Object.assign(emitter, {
                write: mockWrite,
                destroy: mockDestroy,
            }) as any;
            return mockSocket;
        }),
    };
});

describe("connectToSocket", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (addTransport as jest.Mock).mockReturnValue(mockRemoveTransport);
    });

    describe("successful handshake", () => {
        it("should send SYN on connect and resolve on ACK", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            // Simulate connection established
            mockSocket.emit("connect");

            // Client should send SYN
            expect(mockSocket.write).toHaveBeenCalledTimes(1);
            const synData = JSON.parse(mockSocket.write.mock.calls[0][0].trim());
            expect(synData).toEqual(createUdsSyn());

            // Server sends ACK
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            const cleanup = await promise;

            // Transport should be registered
            expect(addTransport).toHaveBeenCalledTimes(1);

            // Cleanup function should work
            expect(typeof cleanup).toBe("function");
            cleanup();
            expect(mockRemoveTransport).toHaveBeenCalledTimes(1);
            expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe("timeout", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should reject with PostalUdsHandshakeTimeoutError if no ACK arrives", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock", { timeout: 1000 });

            mockSocket.emit("connect");

            // Advance past timeout
            jest.advanceTimersByTime(1001);

            await expect(promise).rejects.toBeInstanceOf(PostalUdsHandshakeTimeoutError);
            expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe("connection refused", () => {
        it("should reject with the underlying error", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            const err: any = new Error("connect ECONNREFUSED");
            err.code = "ECONNREFUSED";
            mockSocket.emit("error", err);

            await expect(promise).rejects.toThrow("connect ECONNREFUSED");
            expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe("onDisconnect callback", () => {
        it("should fire when the socket closes unexpectedly", async () => {
            const onDisconnect = jest.fn();
            const promise = connectToSocket("/tmp/postal-test.sock", { onDisconnect });

            mockSocket.emit("connect");
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            await promise;

            // Simulate server going away
            mockSocket.emit("close");

            expect(onDisconnect).toHaveBeenCalledTimes(1);
        });

        it("should NOT fire when the cleanup function is called explicitly", async () => {
            const onDisconnect = jest.fn();
            const promise = connectToSocket("/tmp/postal-test.sock", { onDisconnect });

            mockSocket.emit("connect");
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            const cleanup = await promise;

            // Consumer intentionally disconnects — onDisconnect should NOT fire
            cleanup();

            // Simulate the close event that socket.destroy() would trigger
            mockSocket.emit("close");

            expect(onDisconnect).not.toHaveBeenCalled();
        });
    });

    describe("version mismatch", () => {
        it("should reject with PostalUdsVersionMismatchError if ACK has wrong version", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            mockSocket.emit("connect");

            // Server sends ACK with wrong version
            mockSocket.emit(
                "data",
                ndjsonSerializer.encode({ type: "postal:uds-ack", version: 999 })
            );

            const err = await promise.catch((e: unknown) => e);
            expect(err).toBeInstanceOf(PostalUdsVersionMismatchError);
            expect((err as PostalUdsVersionMismatchError).received).toBe(999);
            expect((err as PostalUdsVersionMismatchError).expected).toBe(PROTOCOL_VERSION);
            expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
            expect(addTransport).not.toHaveBeenCalled();
        });
    });

    describe("non-ACK messages during handshake", () => {
        it("should ignore non-ACK messages and still resolve on ACK", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            mockSocket.emit("connect");

            // Send some noise before the real ACK
            mockSocket.emit("data", ndjsonSerializer.encode({ type: "not-postal" }));
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsSyn()));
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            const cleanup = await promise;
            expect(typeof cleanup).toBe("function");
            expect(addTransport).toHaveBeenCalledTimes(1);

            cleanup();
        });
    });

    describe("error after settlement", () => {
        it("should not double-reject if error fires after timeout", async () => {
            jest.useFakeTimers();

            const promise = connectToSocket("/tmp/postal-test.sock", { timeout: 500 });
            mockSocket.emit("connect");

            jest.advanceTimersByTime(501);

            await expect(promise).rejects.toBeInstanceOf(PostalUdsHandshakeTimeoutError);

            // Late error after promise already rejected — should not throw
            mockSocket.emit("error", new Error("late error"));

            jest.useRealTimers();
        });

        it("should not double-resolve if ACK arrives after ACK already handled", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");
            mockSocket.emit("connect");

            // First ACK — resolves
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));
            const cleanup = await promise;

            // Second ACK — should be ignored (data listener removed, settled=true)
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            // Should still only have one transport registered
            expect(addTransport).toHaveBeenCalledTimes(1);

            cleanup();
        });
    });

    describe("connection error before connect event", () => {
        it("should reject with the socket error (e.g. ENOENT)", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            const err: any = new Error("connect ENOENT /tmp/postal-test.sock");
            err.code = "ENOENT";
            mockSocket.emit("error", err);

            await expect(promise).rejects.toThrow("ENOENT");
            expect(mockSocket.destroy).toHaveBeenCalledTimes(1);
            expect(addTransport).not.toHaveBeenCalled();
        });
    });

    describe("no onDisconnect callback", () => {
        it("should not attach a close listener if onDisconnect is not provided", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");
            mockSocket.emit("connect");
            mockSocket.emit("data", ndjsonSerializer.encode(createUdsAck()));

            const cleanup = await promise;

            // Emitting close should not throw even without onDisconnect
            mockSocket.emit("close");

            cleanup();
        });
    });

    describe("SYN not sent if settled before connect", () => {
        it("should not send SYN if error occurs before connect event", async () => {
            const promise = connectToSocket("/tmp/postal-test.sock");

            // Error fires before connect
            mockSocket.emit("error", new Error("ECONNREFUSED"));

            await expect(promise).rejects.toThrow("ECONNREFUSED");

            // Now the connect event fires late
            mockSocket.emit("connect");

            // SYN should NOT have been written because settled=true
            expect(mockSocket.write).not.toHaveBeenCalled();
        });
    });
});
