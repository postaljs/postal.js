// ProcessList — shows active tasks grouped by PID.
//
// "Active tasks by process" is derived entirely from task events, not from
// socket-level connection state (listenOnSocket doesn't expose that).
// A process is "active" if it has at least one running task.

import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import type { ActiveTask } from "../monitor-state.js";
import { formatDuration } from "./format.js";

export type ProcessListProps = {
    /** All tasks — running and recently finished — keyed by taskId. */
    tasks: Map<string, ActiveTask>;
};

/**
 * Group tasks by PID so we can show what each process is doing.
 * Within each group, running tasks appear first (sorted by start time).
 */
const groupByPid = (tasks: Map<string, ActiveTask>): Map<number, ActiveTask[]> => {
    const groups = new Map<number, ActiveTask[]>();
    for (const task of tasks.values()) {
        const existing = groups.get(task.pid) ?? [];
        groups.set(task.pid, [...existing, task]);
    }
    return groups;
};

export const ProcessList: React.FC<ProcessListProps> = ({ tasks }) => {
    if (tasks.size === 0) {
        return (
            <Box paddingLeft={2}>
                <Text dimColor>No active tasks. Run start:launcher in another terminal.</Text>
            </Box>
        );
    }

    const grouped = groupByPid(tasks);

    return (
        <Box flexDirection="column">
            {[...grouped.entries()].map(([pid, pidTasks]) => (
                <Box key={pid} flexDirection="column" paddingLeft={1}>
                    <Text>
                        {chalk.dim("pid")} {chalk.bold(String(pid))}
                    </Text>
                    {pidTasks.map(task => {
                        const isRunning = task.success === undefined;
                        const statusIcon = isRunning
                            ? chalk.yellow("▶")
                            : task.success
                              ? chalk.green("✓")
                              : chalk.red("✗");

                        const durationStr =
                            task.duration !== undefined
                                ? chalk.dim(` ${formatDuration(task.duration)}`)
                                : "";

                        const errorStr =
                            task.error !== undefined ? chalk.red(` — ${task.error}`) : "";

                        return (
                            <Box key={task.taskId} paddingLeft={2}>
                                <Text>
                                    {statusIcon} {chalk.cyan(task.package)}
                                    {chalk.dim(" ")}
                                    {chalk.white(task.command)}
                                    {durationStr}
                                    {errorStr}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
};
