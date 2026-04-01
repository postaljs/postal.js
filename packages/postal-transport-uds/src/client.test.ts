/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { EventEmitter } from "events";
// net is mocked below — import kept for type reference only
import { ndjsonSerializer } from "./serialization";
import { createUdsSyn, createUdsAck } from "./protocol";
import { PostalUdsHandshakeTimeoutError } from "./errors";

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
    });
});
