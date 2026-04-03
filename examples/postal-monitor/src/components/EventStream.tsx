// EventStream — scrolling log of task events, most recent at the bottom.
//
// Capped at MAX_EVENT_LOG_SIZE entries (managed in monitor-state.ts) to
// prevent unbounded memory growth and Ink re-render slowdowns during long demos.

import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import type { EventLogEntry } from "../monitor-state.js";
import { formatDuration } from "./format.js";

export type EventStreamProps = {
    /** Ordered event log entries — oldest first, newest last. */
    entries: EventLogEntry[];
    /** Max visible lines in the panel. When set, only the most recent N entries are shown. */
    maxVisible?: number;
};

/** Format a Unix timestamp as HH:MM:SS. */
const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
};

/** Render a single event log line. */
const EventLine: React.FC<{ entry: EventLogEntry }> = ({ entry }) => {
    const time = chalk.dim(formatTime(entry.timestamp));
    const pkg = chalk.cyan(entry.package);
    const cmd = chalk.white(entry.command);
    const pid = chalk.dim(`[${entry.pid}]`);

    if (entry.type === "started") {
        return (
            <Box paddingLeft={1}>
                <Text>
                    {time} {chalk.yellow("▶ start")} {pkg} {cmd} {pid}
                </Text>
            </Box>
        );
    }

    // finished entry
    const durationStr = chalk.dim(formatDuration(entry.duration));
    const statusIcon = entry.success ? chalk.green("✓  done") : chalk.red("✗  fail");
    const errorStr = entry.error ? chalk.red(` — ${entry.error}`) : "";

    return (
        <Box paddingLeft={1}>
            <Text>
                {time} {statusIcon} {pkg} {cmd} {pid} {durationStr}
                {errorStr}
            </Text>
        </Box>
    );
};

export const EventStream: React.FC<EventStreamProps> = ({ entries, maxVisible }) => {
    if (entries.length === 0) {
        return (
            <Box paddingLeft={2}>
                <Text dimColor>No events yet.</Text>
            </Box>
        );
    }

    // Show only the most recent entries that fit in the panel
    const visible =
        maxVisible !== undefined && entries.length > maxVisible
            ? entries.slice(-maxVisible)
            : entries;

    return (
        <Box flexDirection="column">
            {visible.map((entry, i) => (
                <EventLine key={`${entry.taskId}-${entry.type}-${i}`} entry={entry} />
            ))}
        </Box>
    );
};
