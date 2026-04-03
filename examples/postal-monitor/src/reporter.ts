// Reporter — thin wrapper around postal-transport-uds.
//
// This is the pedagogical core of the example. The goal is to make the postal
// UDS API visible and easy to follow:
//
//   1. connectToSocket()  — establish a UDS connection to the monitor
//   2. getChannel()       — get a typed reference to the "monitor" channel
//   3. channel.publish()  — fire-and-forget task events toward the monitor
//
// Nothing else. No queuing, no retry, no fancy abstractions.

import { connectToSocket } from "postal-transport-uds";
import { getChannel } from "postal";
import type { TaskStartedPayload, TaskFinishedPayload } from "./types.js";

/** Shape returned by createReporter. */
export type Reporter = {
    /**
     * Publish a task.started event and return the generated taskId.
     * The caller uses the returned taskId when calling reportFinished.
     */
    reportStarted: (info: { package: string; command: string; pid: number }) => string;

    /** Publish a task.finished event. */
    reportFinished: (info: {
        taskId: string;
        package: string;
        command: string;
        pid: number;
        success: boolean;
        duration: number;
        error?: string;
    }) => void;

    /**
     * Tear down the UDS connection.
     * Call this after all tasks have reported so the monitor knows this
     * reporter process is done.
     */
    disconnect: () => void;
};

/**
 * Connect to the monitor's UDS socket and return a reporter.
 *
 * Resolves once the SYN/ACK handshake completes — postal envelopes can be
 * published immediately after this resolves.
 */
export const createReporter = async (socketPath: string): Promise<Reporter> => {
    // connectToSocket performs the SYN/ACK handshake and registers a postal
    // Transport for the socket. The returned function removes the transport
    // and closes the socket when called.
    const disconnect = await connectToSocket(socketPath);

    // getChannel returns the channel instance — publish() sends an envelope
    // through every registered transport, including the UDS socket we just wired up.
    const channel = getChannel("monitor");

    let taskCounter = 0;

    const reportStarted = (info: { package: string; command: string; pid: number }): string => {
        // Generate a simple unique ID: pid + monotonic counter + timestamp.
        // No UUID dependency needed for a demo.
        taskCounter += 1;
        const taskId = `${process.pid}-${taskCounter}-${Date.now()}`;

        const payload: TaskStartedPayload = {
            taskId,
            package: info.package,
            command: info.command,
            pid: info.pid,
        };

        // This is the publish call we want readers to notice — one line to
        // send a typed event to every subscriber across process boundaries.
        channel.publish("task.started", payload);

        return taskId;
    };

    const reportFinished = (info: {
        taskId: string;
        package: string;
        command: string;
        pid: number;
        success: boolean;
        duration: number;
        error?: string;
    }): void => {
        const payload: TaskFinishedPayload = {
            taskId: info.taskId,
            package: info.package,
            command: info.command,
            pid: info.pid,
            success: info.success,
            duration: info.duration,
            ...(info.error !== undefined && { error: info.error }),
        };

        channel.publish("task.finished", payload);
    };

    return { reportStarted, reportFinished, disconnect };
};
