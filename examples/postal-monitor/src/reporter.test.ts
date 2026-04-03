/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// reporter.test.ts — happy-path tests for the reporter module.
//
// Strategy: mock postal-transport-uds and postal so we can verify that
// createReporter wires them together correctly without touching a real socket.

import type { Reporter } from "./reporter.js";

// --- Module-level mock declarations ---

const mockConnectToSocket = jest.fn();
const mockPublish = jest.fn();
const mockGetChannel = jest.fn();

jest.mock("postal-transport-uds", () => ({
    connectToSocket: mockConnectToSocket,
}));

jest.mock("postal", () => ({
    getChannel: mockGetChannel,
}));

// --- Tests ---

describe("reporter module", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe("createReporter", () => {
        describe("when connecting to a socket", () => {
            let reporter: Reporter;
            let mockDisconnect: jest.Mock;

            beforeEach(async () => {
                mockDisconnect = jest.fn();
                mockConnectToSocket.mockResolvedValue(mockDisconnect);
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                reporter = await createReporter("/tmp/test-monitor.sock");
            });

            it("should call connectToSocket with the provided socket path", () => {
                expect(mockConnectToSocket).toHaveBeenCalledTimes(1);
                expect(mockConnectToSocket).toHaveBeenCalledWith("/tmp/test-monitor.sock");
            });

            it("should call getChannel with the monitor channel name", () => {
                expect(mockGetChannel).toHaveBeenCalledTimes(1);
                expect(mockGetChannel).toHaveBeenCalledWith("monitor");
            });

            it("should return a reporter with the expected API", () => {
                expect(typeof reporter.reportStarted).toBe("function");
                expect(typeof reporter.reportFinished).toBe("function");
                expect(typeof reporter.disconnect).toBe("function");
            });
        });

        describe("reportStarted", () => {
            let reporter: Reporter;

            beforeEach(async () => {
                mockConnectToSocket.mockResolvedValue(jest.fn());
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                reporter = await createReporter("/tmp/test-monitor.sock");
            });

            describe("when called with package, command, and pid", () => {
                let taskId: string;

                beforeEach(() => {
                    taskId = reporter.reportStarted({
                        package: "postal",
                        command: "test",
                        pid: 42,
                    });
                });

                it("should publish to task.started topic", () => {
                    expect(mockPublish).toHaveBeenCalledTimes(1);
                    expect(mockPublish).toHaveBeenCalledWith(
                        "task.started",
                        expect.objectContaining({
                            package: "postal",
                            command: "test",
                            pid: 42,
                        })
                    );
                });

                it("should return a non-empty string taskId", () => {
                    expect(typeof taskId).toBe("string");
                    expect(taskId.length).toBeGreaterThan(0);
                });

                it("should include the taskId in the published payload", () => {
                    expect(mockPublish).toHaveBeenCalledWith(
                        "task.started",
                        expect.objectContaining({ taskId })
                    );
                });
            });

            describe("when called twice", () => {
                let firstTaskId: string, secondTaskId: string;

                beforeEach(() => {
                    firstTaskId = reporter.reportStarted({
                        package: "postal",
                        command: "lint",
                        pid: 100,
                    });
                    secondTaskId = reporter.reportStarted({
                        package: "postal",
                        command: "build",
                        pid: 101,
                    });
                });

                it("should produce unique taskIds on each call", () => {
                    expect(firstTaskId).not.toBe(secondTaskId);
                });
            });
        });

        describe("reportFinished", () => {
            let reporter: Reporter;

            beforeEach(async () => {
                mockConnectToSocket.mockResolvedValue(jest.fn());
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                reporter = await createReporter("/tmp/test-monitor.sock");
            });

            describe("when called with a successful result", () => {
                beforeEach(() => {
                    reporter.reportFinished({
                        taskId: "TASK-001",
                        package: "postal",
                        command: "test",
                        pid: 42,
                        success: true,
                        duration: 1234,
                    });
                });

                it("should publish to task.finished topic", () => {
                    expect(mockPublish).toHaveBeenCalledTimes(1);
                    expect(mockPublish).toHaveBeenCalledWith(
                        "task.finished",
                        expect.objectContaining({
                            taskId: "TASK-001",
                            package: "postal",
                            command: "test",
                            pid: 42,
                            success: true,
                            duration: 1234,
                        })
                    );
                });

                it("should not include an error field when success is true", () => {
                    const [, payload] = mockPublish.mock.calls[0] as [string, any];
                    expect(payload).not.toHaveProperty("error");
                });
            });

            describe("when called with a failed result", () => {
                beforeEach(() => {
                    reporter.reportFinished({
                        taskId: "TASK-002",
                        package: "postal",
                        command: "build",
                        pid: 43,
                        success: false,
                        duration: 500,
                        error: "Process exited with code 1",
                    });
                });

                it("should publish to task.finished with error field", () => {
                    expect(mockPublish).toHaveBeenCalledTimes(1);
                    expect(mockPublish).toHaveBeenCalledWith(
                        "task.finished",
                        expect.objectContaining({
                            success: false,
                            error: "Process exited with code 1",
                        })
                    );
                });
            });
        });

        describe("disconnect", () => {
            let reporter: Reporter;
            let mockDisconnect: jest.Mock;

            beforeEach(async () => {
                mockDisconnect = jest.fn();
                mockConnectToSocket.mockResolvedValue(mockDisconnect);
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                reporter = await createReporter("/tmp/test-monitor.sock");
                reporter.disconnect();
            });

            it("should call the cleanup function returned by connectToSocket", () => {
                expect(mockDisconnect).toHaveBeenCalledTimes(1);
            });
        });

        describe("when disconnect is called twice", () => {
            let reporter: Reporter;
            let mockDisconnect: jest.Mock;

            beforeEach(async () => {
                mockDisconnect = jest.fn();
                mockConnectToSocket.mockResolvedValue(mockDisconnect);
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                reporter = await createReporter("/tmp/test-monitor.sock");
                reporter.disconnect();
                reporter.disconnect();
            });

            it("should call the underlying cleanup function both times", () => {
                // reporter.disconnect() is a thin pass-through — no idempotency guard.
                // Callers are responsible for not double-disconnecting; we verify
                // the actual delegation behavior here.
                expect(mockDisconnect).toHaveBeenCalledTimes(2);
            });
        });

        describe("when connectToSocket rejects", () => {
            let caughtError: unknown;

            beforeEach(async () => {
                mockConnectToSocket.mockRejectedValue(
                    new Error("E_COLD_CALZONE: socket not found")
                );
                mockGetChannel.mockReturnValue({ publish: mockPublish });

                const { createReporter } = await import("./reporter.js");
                try {
                    await createReporter("/tmp/missing.sock");
                } catch (err) {
                    caughtError = err;
                }
            });

            it("should propagate the rejection to the caller", () => {
                expect(caughtError).toBeInstanceOf(Error);
                expect((caughtError as Error).message).toContain("E_COLD_CALZONE");
            });
        });
    });
});
