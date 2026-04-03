// App — root Ink layout component for the postal-monitor TUI.
//
// Two-column layout: active tasks on the left, event stream on the right.
// Sized to the terminal height so the event stream scrolls within bounds.
// State flows in via props — no subscriptions or side effects here.

import React from "react";
import { Box, Text, useStdout } from "ink";
import chalk from "chalk";
import { ProcessList } from "./ProcessList.js";
import { EventStream } from "./EventStream.js";
import type { MonitorState } from "../monitor-state.js";

export type AppProps = {
    /** Current monitor state — tasks and event log. */
    state: MonitorState;
};

// Header takes 2 lines + 1 blank line before the panels = 3 rows.
// Borders add 2 rows (top + bottom). Subtract from terminal height
// to get the usable inner height for panel content.
const HEADER_ROWS = 3;
const BORDER_ROWS = 2;

const App: React.FC<AppProps> = ({ state }) => {
    const { stdout } = useStdout();
    const termRows = stdout.rows ?? 24;
    const panelHeight = Math.max(termRows - HEADER_ROWS - BORDER_ROWS, 6);

    return (
        <Box flexDirection="column" height={termRows}>
            {/* Header */}
            <Box>
                <Text>
                    {chalk.rgb(100, 180, 255)(" POSTAL MONITOR ")}
                    {chalk.dim("─────────────────────────────────────────────────────")}
                </Text>
            </Box>
            <Box>
                <Text>
                    {chalk.dim(
                        " Monitor for postal-transport-uds — watching /tmp/postal-monitor.sock"
                    )}
                </Text>
            </Box>

            {/* Two-column layout */}
            <Box marginTop={1} flexGrow={1}>
                {/* Left panel — Active Tasks */}
                <Box
                    flexDirection="column"
                    width="40%"
                    height={panelHeight}
                    borderStyle="single"
                    borderColor="yellow"
                    overflowY="hidden"
                >
                    <Box>
                        <Text bold>{chalk.yellow(" Active Tasks")}</Text>
                    </Box>
                    <ProcessList tasks={state.activeTasks} />
                </Box>

                {/* Right panel — Event Stream */}
                <Box
                    flexDirection="column"
                    width="60%"
                    height={panelHeight}
                    borderStyle="single"
                    borderColor="cyan"
                    overflowY="hidden"
                >
                    <Box>
                        <Text bold>{chalk.cyan(" Event Stream")}</Text>
                    </Box>
                    <EventStream
                        entries={state.eventLog}
                        maxVisible={panelHeight - BORDER_ROWS - 1}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default App;
