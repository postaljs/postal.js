// VuMeter — single stereo channel level bar.
//
// Renders: LABEL [bar...] dB
// Bar: green→yellow→red gradient fill (RMS level), yellow peak-hold marker.

import React from "react";
import { Text } from "ink";
import chalk from "chalk";
import { vuColor } from "../lib/colors.js";
import type { LevelData } from "../types.js";

export type VuMeterProps = {
    /** Channel label (e.g. "L" or "R"). */
    label: string;
    /** Current RMS + peak-hold levels for this channel. */
    level: LevelData;
    /** Available width in characters for the entire meter line. */
    width: number;
};

/**
 * Single-channel VU meter bar with green→yellow→red gradient and peak-hold marker.
 *
 * The filled portion (▓) represents the current RMS level. A bright yellow
 * block (█) marks the recent peak, decaying slowly — same behavior as a
 * hardware VU meter's ballistic needle. The dB readout converts the 0–1
 * RMS value to decibels relative to full scale.
 */
export const VuMeter: React.FC<VuMeterProps> = ({ label, level, width }) => {
    // Reserve 2 chars for label + space, 7 for the dB readout.
    const barWidth = Math.max(0, width - 10);
    const rmsBlocks = Math.round(level.rms * barWidth);
    const peakPos = Math.min(barWidth - 1, Math.round(level.peak * barWidth));

    let bar = "";
    for (let i = 0; i < barWidth; i++) {
        const [r, g, b] = vuColor(i / barWidth);
        if (i === peakPos && level.peak > 0.05) {
            bar += chalk.rgb(255, 255, 0)("█"); // peak hold marker — always yellow
        } else if (i < rmsBlocks) {
            bar += chalk.rgb(r, g, b)("▓");
        } else {
            bar += chalk.dim("░");
        }
    }

    const dbVal = level.rms > 0 ? 20 * Math.log10(level.rms) : -Infinity;
    const dbStr = isFinite(dbVal) ? `${dbVal.toFixed(0)} dB`.padStart(6) : "  -∞ dB";

    return (
        <Text>
            {chalk.bold(label)} {bar} {chalk.dim(dbStr)}
        </Text>
    );
};
