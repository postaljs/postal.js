// Header component — station name, bitrate/format, nav arrows, bus activity dot.
//
// Uses chalk for per-character RGB coloring because Ink's <Text color="">
// only supports named colors and hex strings, not per-segment RGB gradients.

import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import type { Station } from "../stations.js";
import type { StationMeta } from "../types.js";

export type HeaderProps = {
    /** Currently selected station definition (from the hardcoded registry). */
    station: Station | null;
    /** Zero-based index into the STATIONS array. */
    stationIndex: number;
    /** Total number of available stations (for the "[1/4]" display). */
    stationCount: number;
    /** Live metadata from the SomaFM API (null until the first fetch completes). */
    stationMeta: StationMeta | null;
    /** True for 100ms after any postal message — drives the activity dot. */
    busActivity: boolean;
    /** Whether the app was started with --play (sox audio output). */
    audioEnabled: boolean;
};

/**
 * Three-line header: title bar, station nav line, genre/listeners/audio status.
 *
 * The activity dot (● / ○) is driven by a wiretap on the postal bus — it
 * flashes green briefly on every message, giving a visual heartbeat that
 * confirms the child processes are alive and publishing data.
 */
export const Header: React.FC<HeaderProps> = ({
    station,
    stationIndex,
    stationCount,
    stationMeta,
    busActivity,
    audioEnabled,
}) => {
    const stationName = station ? station.name.toUpperCase() : "POSTAL FM";
    const bitrateInfo = station ? `${station.bitrate} kbps  ${station.format}` : "";
    const stationNum = stationCount > 0 ? ` [${stationIndex + 1}/${stationCount}]` : "";
    const activityDot = busActivity ? chalk.rgb(0, 255, 100)("●") : chalk.dim("○");
    const genreListeners = stationMeta
        ? `${stationMeta.genre}   ${stationMeta.listeners.toLocaleString()} listeners`
        : "Connecting...";
    const audioStatus = audioEnabled ? "  audio: on" : "";

    return (
        <Box flexDirection="column">
            {/* Title bar */}
            <Text>
                {chalk.rgb(100, 180, 255)(" POSTAL FM ")}
                {chalk.dim("─────────────────────────────────────────────────────")}
            </Text>
            {/* Station nav line */}
            <Text>
                {" "}
                {chalk.dim("◄")} {chalk.bold(stationName)}
                {chalk.dim(stationNum)}
                {"   "}
                {chalk.dim(bitrateInfo)}
                {"  "}
                {activityDot}
                {"  "}
                {chalk.dim("►")}
            </Text>
            {/* Genre / listeners */}
            <Text>
                {" "}
                {chalk.dim(genreListeners)}
                {chalk.dim(audioStatus)}
            </Text>
        </Box>
    );
};
