/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// launcher.test.ts — happy-path tests for the runTask helper in task-runner.ts.
//
// Strategy: mock child_process.spawn so we don't actually run pnpm.
// We verify that runTask correctly calls reportStarted/reportFinished
// with the expected arguments based on the child process exit code.
//
// Tests import from task-runner.ts (not launcher.ts) because launcher.ts
// is the entry point — it calls main() at module load time and contains
// import.meta.url, which is incompatible with ts-jest's CJS transform.

// --- Module-level mock declarations ---

const mockSpawn = jest.fn();

jest.mock("node:child_process", () => ({
    spawn: mockSpawn,
}));

// --- Helpers ---

/** A minimal EventEmitter that satisfies the ChildProcess surface we use. */
const makeChildStub = (): {
    pid: number;
    on: jest.Mock;
    emit: (event: string, ...args: any[]) => void;
} => {
    const listeners: Record<string, ((...args: any[]) => void)[]> = {};
    return {
        pid: 8675309,
        on: jest.fn((event: string, cb: (...args: any[]) => void) => {
            listeners[event] = listeners[event] ?? [];
            listeners[event].push(cb);
        }),
        emit(event: string, ...args: any[]) {
            for (const cb of listeners[event] ?? []) {
                cb(...args);
            }
        },
    };
};

// --- Tests ---

describe("task-runner module", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe("runTask", () => {
        describe("when the child process exits with code 0 (success)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;
            let returnedTaskId: string;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-42");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal", command: "test" };

                const { runTask } = await import("./task-runner.js");

                // Start the task — it won't resolve until we emit 'close'
                const taskPromise = runTask(task, reporter, "/monorepo");

                // Capture the taskId returned by reportStarted
                returnedTaskId = mockReportStarted.mock.results[0].value as string;

                // Simulate child process finishing successfully
                child.emit("close", 0);

                await taskPromise;
            });

            it("should spawn pnpm with --filter and the package/command", () => {
                expect(mockSpawn).toHaveBeenCalledTimes(1);
                expect(mockSpawn).toHaveBeenCalledWith(
                    "pnpm",
                    ["--filter", "postal", "test"],
                    expect.objectContaining({ cwd: "/monorepo", stdio: "ignore" })
                );
            });

            it("should call reportStarted with the correct package, command, and pid", () => {
                expect(mockReportStarted).toHaveBeenCalledTimes(1);
                expect(mockReportStarted).toHaveBeenCalledWith({
                    package: "postal",
                    command: "test",
                    pid: 8675309,
                });
            });

            it("should call reportFinished with success: true", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
                expect(mockReportFinished).toHaveBeenCalledWith(
                    expect.objectContaining({
                        taskId: returnedTaskId,
                        package: "postal",
                        command: "test",
                        pid: 8675309,
                        success: true,
                    })
                );
            });

            it("should not include an error field in the finished payload", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload).not.toHaveProperty("error");
            });

            it("should include a non-negative duration in the finished payload", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.duration).toBeGreaterThanOrEqual(0);
            });
        });

        describe("when the child process exits with a non-zero code (failure)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-99");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal", command: "build" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                child.emit("close", 1);

                await taskPromise;
            });

            it("should call reportFinished with success: false", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
                expect(mockReportFinished).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: false,
                    })
                );
            });

            it("should include an error message describing the exit code", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.error).toContain("1");
            });
        });

        describe("when spawn emits an error (e.g. pnpm not found)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-ERR");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal", command: "test" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                child.emit("error", new Error("E_SOGGY_STROMBOLI: pnpm binary not found"));

                await taskPromise;
            });

            it("should call reportFinished with success: false", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
                expect(mockReportFinished).toHaveBeenCalledWith(
                    expect.objectContaining({ success: false })
                );
            });

            it("should include the error message in the finished payload", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.error).toContain("E_SOGGY_STROMBOLI");
            });
        });

        describe("when both error and close fire (Node double-event on spawn failure)", () => {
            // Node fires 'error' followed by 'close' when the binary is not found.
            // The 'settled' guard must ensure reportFinished is only called once.
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-DOUBLE");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal", command: "test" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                // Simulate the real Node behaviour: error fires, then close fires.
                child.emit("error", new Error("spawn pnpm ENOENT"));
                child.emit("close", null);

                await taskPromise;
            });

            it("should call reportFinished exactly once despite both events firing", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
            });

            it("should report the error from the error event, not a null exit code", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.error).toContain("ENOENT");
            });
        });

        describe("when the error event fires twice (double-emit guard on error handler)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-DOUBLE-ERR");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal", command: "lint" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                child.emit("error", new Error("first error"));
                child.emit("error", new Error("second error"));

                await taskPromise;
            });

            it("should call reportFinished exactly once", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
            });

            it("should report the first error", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.error).toContain("first error");
            });
        });

        describe("when child.pid is undefined (spawn fails before pid is assigned)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                // Simulate spawn returning a process with no pid (undefined)
                (child as any).pid = undefined;
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-NOPID");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal-transport-uds", command: "test" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                child.emit("close", 0);

                await taskPromise;
            });

            it("should call reportStarted with pid 0 as the fallback", () => {
                expect(mockReportStarted).toHaveBeenCalledTimes(1);
                expect(mockReportStarted).toHaveBeenCalledWith(expect.objectContaining({ pid: 0 }));
            });

            it("should call reportFinished with pid 0", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
                expect(mockReportFinished).toHaveBeenCalledWith(
                    expect.objectContaining({ pid: 0 })
                );
            });
        });

        describe("when close fires with null exit code (no prior error event)", () => {
            let child: ReturnType<typeof makeChildStub>;
            let mockReportStarted: jest.Mock, mockReportFinished: jest.Mock;

            beforeEach(async () => {
                child = makeChildStub();
                mockSpawn.mockReturnValue(child);

                mockReportStarted = jest.fn();
                mockReportFinished = jest.fn();
                mockReportStarted.mockReturnValue("TASK-NULL-EXIT");

                const reporter = {
                    reportStarted: mockReportStarted,
                    reportFinished: mockReportFinished,
                };

                const task = { package: "postal-transport-childprocess", command: "test" };

                const { runTask } = await import("./task-runner.js");
                const taskPromise = runTask(task, reporter, "/monorepo");

                child.emit("close", null);

                await taskPromise;
            });

            it("should call reportFinished with success: false", () => {
                expect(mockReportFinished).toHaveBeenCalledTimes(1);
                expect(mockReportFinished).toHaveBeenCalledWith(
                    expect.objectContaining({ success: false })
                );
            });

            it("should include 'null' in the error message", () => {
                const [payload] = mockReportFinished.mock.calls[0] as [any];
                expect(payload.error).toContain("null");
            });
        });
    });
});
