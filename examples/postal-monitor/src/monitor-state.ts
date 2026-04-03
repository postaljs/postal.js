// monitor-state.ts — pure state reducer for the monitor TUI.
//
// Extracted from monitor.tsx so the state logic can be tested without
// requiring Ink, React, or a live UDS socket.
//
// The monitor derives all "connected process" info from task events — it
// never consults socket-level connection state. This is simpler and gives
// a more useful "active tasks by process" view anyway.

import type { TaskStartedPayload, TaskFinishedPayload } from "./types.js";

/** Maximum number of entries kept in the event log. */
export const MAX_EVENT_LOG_SIZE = 50;

/** A task that has started and may or may not have finished. */
export type ActiveTask = {
    taskId: string;
    package: string;
    command: string;
    pid: number;
    startedAt: number;
    /** Set when task.finished is received. */
    success?: boolean;
    /** Set when task.finished is received (ms). */
    duration?: number;
    /** Set when task.finished reports an error. */
    error?: string;
};

/** A single entry in the scrolling event log. */
export type EventLogEntry =
    | {
          type: "started";
          timestamp: number;
          taskId: string;
          package: string;
          command: string;
          pid: number;
      }
    | {
          type: "finished";
          timestamp: number;
          taskId: string;
          package: string;
          command: string;
          pid: number;
          success: boolean;
          duration: number;
          error?: string;
      };

/** The full monitor UI state. */
export type MonitorState = {
    /** Tasks keyed by taskId. Includes in-progress and recently finished tasks. */
    activeTasks: Map<string, ActiveTask>;
    /** Append-only event log, capped at MAX_EVENT_LOG_SIZE entries. */
    eventLog: EventLogEntry[];
};

/** Initial state for a fresh monitor session. */
export const createInitialState = (): MonitorState => ({
    activeTasks: new Map(),
    eventLog: [],
});

/**
 * Reduce a task.started event into a new MonitorState.
 *
 * Returns a new state object (immutable update pattern) so React's
 * useState comparison can detect the change and trigger a re-render.
 */
export const applyTaskStarted = (
    state: MonitorState,
    payload: TaskStartedPayload
): MonitorState => {
    const task: ActiveTask = {
        taskId: payload.taskId,
        package: payload.package,
        command: payload.command,
        pid: payload.pid,
        startedAt: Date.now(),
    };

    const nextActiveTasks = new Map(state.activeTasks);
    nextActiveTasks.set(payload.taskId, task);

    const entry: EventLogEntry = {
        type: "started",
        timestamp: Date.now(),
        taskId: payload.taskId,
        package: payload.package,
        command: payload.command,
        pid: payload.pid,
    };

    const nextEventLog = appendEventLog(state.eventLog, entry);

    return { activeTasks: nextActiveTasks, eventLog: nextEventLog };
};

/**
 * Reduce a task.finished event into a new MonitorState.
 *
 * Updates the task record in activeTasks (so the UI can show a final
 * success/error state) and appends to the event log.
 */
export const applyTaskFinished = (
    state: MonitorState,
    payload: TaskFinishedPayload
): MonitorState => {
    const existing = state.activeTasks.get(payload.taskId);

    const updated: ActiveTask = {
        // Fall back to the payload fields if somehow we never saw the started event
        taskId: payload.taskId,
        package: payload.package,
        command: payload.command,
        pid: payload.pid,
        startedAt: existing?.startedAt ?? Date.now() - payload.duration,
        success: payload.success,
        duration: payload.duration,
        ...(payload.error !== undefined && { error: payload.error }),
    };

    const nextActiveTasks = new Map(state.activeTasks);
    nextActiveTasks.set(payload.taskId, updated);

    const entry: EventLogEntry = {
        type: "finished",
        timestamp: Date.now(),
        taskId: payload.taskId,
        package: payload.package,
        command: payload.command,
        pid: payload.pid,
        success: payload.success,
        duration: payload.duration,
        ...(payload.error !== undefined && { error: payload.error }),
    };

    const nextEventLog = appendEventLog(state.eventLog, entry);

    return { activeTasks: nextActiveTasks, eventLog: nextEventLog };
};

/**
 * Append an entry to the event log, trimming to MAX_EVENT_LOG_SIZE.
 *
 * Older entries are dropped from the front — most recent is always at the end.
 */
const appendEventLog = (log: EventLogEntry[], entry: EventLogEntry): EventLogEntry[] => {
    const next = [...log, entry];
    // Drop oldest entries from the front when we exceed the cap.
    // This keeps memory bounded while the demo runs indefinitely.
    if (next.length > MAX_EVENT_LOG_SIZE) {
        return next.slice(next.length - MAX_EVENT_LOG_SIZE);
    }
    return next;
};
