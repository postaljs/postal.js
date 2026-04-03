/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// monitor-state.test.ts — happy-path tests for the monitor state reducer.
//
// Strategy: call the pure reducer functions with synthetic payloads and
// assert the resulting MonitorState shape. No mocks needed — these are
// pure functions.

import {
    createInitialState,
    applyTaskStarted,
    applyTaskFinished,
    MAX_EVENT_LOG_SIZE,
} from "./monitor-state.js";
import type { MonitorState } from "./monitor-state.js";

describe("monitor-state module", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    describe("createInitialState", () => {
        describe("when called with no arguments", () => {
            let state: MonitorState;

            beforeEach(() => {
                state = createInitialState();
            });

            it("should return an empty activeTasks map", () => {
                expect(state.activeTasks.size).toBe(0);
            });

            it("should return an empty eventLog array", () => {
                expect(state.eventLog).toEqual([]);
            });
        });
    });

    describe("applyTaskStarted", () => {
        describe("when a task.started payload is applied to empty state", () => {
            let state: MonitorState;

            beforeEach(() => {
                state = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-001",
                    package: "postal",
                    command: "test",
                    pid: 42,
                });
            });

            it("should add the task to activeTasks", () => {
                expect(state.activeTasks.has("TASK-001")).toBe(true);
            });

            it("should store the correct task fields", () => {
                expect(state.activeTasks.get("TASK-001")).toEqual(
                    expect.objectContaining({
                        taskId: "TASK-001",
                        package: "postal",
                        command: "test",
                        pid: 42,
                    })
                );
            });

            it("should append a started entry to the event log", () => {
                expect(state.eventLog).toHaveLength(1);
                expect(state.eventLog[0]).toEqual(
                    expect.objectContaining({
                        type: "started",
                        taskId: "TASK-001",
                        package: "postal",
                        command: "test",
                        pid: 42,
                    })
                );
            });
        });

        describe("when two different tasks are started", () => {
            let state: MonitorState;

            beforeEach(() => {
                const s1 = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-A",
                    package: "postal",
                    command: "lint",
                    pid: 100,
                });
                state = applyTaskStarted(s1, {
                    taskId: "TASK-B",
                    package: "postal-transport-uds",
                    command: "test",
                    pid: 101,
                });
            });

            it("should have both tasks in activeTasks", () => {
                expect(state.activeTasks.size).toBe(2);
                expect(state.activeTasks.has("TASK-A")).toBe(true);
                expect(state.activeTasks.has("TASK-B")).toBe(true);
            });

            it("should have two entries in the event log", () => {
                expect(state.eventLog).toHaveLength(2);
            });
        });

        describe("when applied to state that already has an existing task", () => {
            let originalState: MonitorState, newState: MonitorState;

            beforeEach(() => {
                originalState = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-001",
                    package: "postal",
                    command: "test",
                    pid: 42,
                });
                newState = applyTaskStarted(originalState, {
                    taskId: "TASK-002",
                    package: "postal",
                    command: "build",
                    pid: 43,
                });
            });

            it("should not mutate the original state's activeTasks map", () => {
                expect(originalState.activeTasks.size).toBe(1);
            });

            it("should return a new state with both tasks", () => {
                expect(newState.activeTasks.size).toBe(2);
            });
        });
    });

    describe("applyTaskFinished", () => {
        describe("when a task.finished payload for a known task is applied", () => {
            let state: MonitorState;

            beforeEach(() => {
                const s1 = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-001",
                    package: "postal",
                    command: "test",
                    pid: 42,
                });
                state = applyTaskFinished(s1, {
                    taskId: "TASK-001",
                    package: "postal",
                    command: "test",
                    pid: 42,
                    success: true,
                    duration: 1500,
                });
            });

            it("should update the task in activeTasks with success and duration", () => {
                expect(state.activeTasks.get("TASK-001")).toEqual(
                    expect.objectContaining({
                        taskId: "TASK-001",
                        success: true,
                        duration: 1500,
                    })
                );
            });

            it("should append a finished entry to the event log", () => {
                // event log: 1 started + 1 finished
                expect(state.eventLog).toHaveLength(2);
                expect(state.eventLog[1]).toEqual(
                    expect.objectContaining({
                        type: "finished",
                        taskId: "TASK-001",
                        success: true,
                        duration: 1500,
                    })
                );
            });

            it("should not include an error field when success is true", () => {
                expect(state.activeTasks.get("TASK-001")).not.toHaveProperty("error");
            });
        });

        describe("when a task.finished payload reports failure", () => {
            let state: MonitorState;

            beforeEach(() => {
                const s1 = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-BAD",
                    package: "postal",
                    command: "build",
                    pid: 99,
                });
                state = applyTaskFinished(s1, {
                    taskId: "TASK-BAD",
                    package: "postal",
                    command: "build",
                    pid: 99,
                    success: false,
                    duration: 300,
                    error: "exited with code 1",
                });
            });

            it("should set success: false on the task", () => {
                expect(state.activeTasks.get("TASK-BAD")).toEqual(
                    expect.objectContaining({ success: false })
                );
            });

            it("should store the error message on the task", () => {
                expect(state.activeTasks.get("TASK-BAD")).toEqual(
                    expect.objectContaining({ error: "exited with code 1" })
                );
            });

            it("should include the error in the event log entry", () => {
                const finishedEntry = state.eventLog[1];
                expect(finishedEntry).toEqual(
                    expect.objectContaining({
                        type: "finished",
                        success: false,
                        error: "exited with code 1",
                    })
                );
            });
        });

        describe("when a task.finished arrives without a prior task.started (late join)", () => {
            let state: MonitorState;

            beforeEach(() => {
                state = applyTaskFinished(createInitialState(), {
                    taskId: "TASK-ORPHAN",
                    package: "postal",
                    command: "lint",
                    pid: 55,
                    success: true,
                    duration: 800,
                });
            });

            it("should still add the task to activeTasks", () => {
                expect(state.activeTasks.has("TASK-ORPHAN")).toBe(true);
            });

            it("should still append a finished entry to the event log", () => {
                expect(state.eventLog).toHaveLength(1);
                expect(state.eventLog[0]).toEqual(
                    expect.objectContaining({ type: "finished", taskId: "TASK-ORPHAN" })
                );
            });
        });
    });

    describe("event log cap", () => {
        describe("when more than MAX_EVENT_LOG_SIZE events are applied", () => {
            let state: MonitorState;

            beforeEach(() => {
                state = createInitialState();
                // Add MAX_EVENT_LOG_SIZE + 5 started events
                for (let i = 0; i < MAX_EVENT_LOG_SIZE + 5; i++) {
                    state = applyTaskStarted(state, {
                        taskId: `TASK-${i}`,
                        package: "postal",
                        command: "test",
                        pid: 1000 + i,
                    });
                }
            });

            it("should cap the event log at MAX_EVENT_LOG_SIZE entries", () => {
                expect(state.eventLog.length).toBe(MAX_EVENT_LOG_SIZE);
            });

            it("should keep the most recent entries (oldest dropped)", () => {
                // The last entry should be the most recently added task
                const lastEntry = state.eventLog[state.eventLog.length - 1];
                expect(lastEntry).toEqual(
                    expect.objectContaining({
                        taskId: `TASK-${MAX_EVENT_LOG_SIZE + 4}`,
                    })
                );
            });
        });

        describe("when exactly MAX_EVENT_LOG_SIZE events are applied", () => {
            let state: MonitorState;

            beforeEach(() => {
                state = createInitialState();
                for (let i = 0; i < MAX_EVENT_LOG_SIZE; i++) {
                    state = applyTaskStarted(state, {
                        taskId: `TASK-${i}`,
                        package: "postal",
                        command: "lint",
                        pid: 2000 + i,
                    });
                }
            });

            it("should keep all entries without trimming", () => {
                expect(state.eventLog.length).toBe(MAX_EVENT_LOG_SIZE);
            });

            it("should preserve the last entry intact", () => {
                expect(state.eventLog[MAX_EVENT_LOG_SIZE - 1]).toEqual(
                    expect.objectContaining({
                        taskId: `TASK-${MAX_EVENT_LOG_SIZE - 1}`,
                    })
                );
            });
        });
    });

    describe("applyTaskStarted with duplicate taskId", () => {
        describe("when task.started fires twice for the same taskId", () => {
            let state: MonitorState;

            beforeEach(() => {
                const s1 = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-DUP",
                    package: "postal",
                    command: "test",
                    pid: 1111,
                });
                state = applyTaskStarted(s1, {
                    taskId: "TASK-DUP",
                    package: "postal",
                    command: "test",
                    pid: 2222,
                });
            });

            it("should not grow activeTasks beyond one entry for that taskId", () => {
                expect(state.activeTasks.size).toBe(1);
            });

            it("should overwrite the prior entry with the latest payload", () => {
                expect(state.activeTasks.get("TASK-DUP")).toEqual(
                    expect.objectContaining({ pid: 2222 })
                );
            });

            it("should append two entries to the event log", () => {
                expect(state.eventLog).toHaveLength(2);
            });
        });
    });

    describe("applyTaskFinished startedAt preservation", () => {
        describe("when task.finished follows a prior task.started", () => {
            let startedState: MonitorState, finishedState: MonitorState;

            beforeEach(() => {
                startedState = applyTaskStarted(createInitialState(), {
                    taskId: "TASK-PRESERVE",
                    package: "postal",
                    command: "build",
                    pid: 3000,
                });
                finishedState = applyTaskFinished(startedState, {
                    taskId: "TASK-PRESERVE",
                    package: "postal",
                    command: "build",
                    pid: 3000,
                    success: true,
                    duration: 750,
                });
            });

            it("should preserve the startedAt value from the started event", () => {
                const startedAt = startedState.activeTasks.get("TASK-PRESERVE")!.startedAt;
                expect(finishedState.activeTasks.get("TASK-PRESERVE")!.startedAt).toBe(startedAt);
            });
        });

        describe("when task.finished arrives with no prior task.started (orphan)", () => {
            let state: MonitorState;
            const DURATION = 600;

            beforeEach(() => {
                state = applyTaskFinished(createInitialState(), {
                    taskId: "TASK-ORPHAN-STARTEDAT",
                    package: "postal",
                    command: "lint",
                    pid: 4000,
                    success: true,
                    duration: DURATION,
                });
            });

            it("should derive startedAt from the current time minus duration", () => {
                const task = state.activeTasks.get("TASK-ORPHAN-STARTEDAT")!;
                // The derived startedAt must be plausibly close to now minus duration
                expect(task.startedAt).toBeGreaterThan(0);
                expect(task.startedAt).toBeLessThanOrEqual(Date.now() - DURATION + 50);
            });
        });
    });
});
