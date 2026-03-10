// SpectrumPane — frequency spectrum bars inside a box-drawing border.
//
// Renders N frequency bins as vertical bar columns using Unicode block chars.
// Each column is rendered top-to-bottom; we transpose from column-major
// (bins[col]) to row-major (one string per terminal row) for Ink output.
//
// Per-character RGB coloring via chalk (Ink's <Text color> doesn't do gradients).

import React, { memo } from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { spectrumColor } from "../lib/colors.js";
import { SPECTRUM_CHARS, SPECTRUM_LEVELS } from "../lib/bar-characters.js";

export type SpectrumPaneProps = {
    /** Normalized frequency bin magnitudes (0–1), one per analysis column. */
    bins: number[];
    /** Full pane width including box-drawing borders. */
    width: number;
    /** Number of content rows (excluding borders and frequency labels). */
    height: number;
};

// The "╔═ SPECTRUM ═...═╗" header needs at least 11 inner chars to not go negative.
const MIN_INNER_WIDTH = 11;

// Frequency label positions.
const FREQ_LABELS = ["20Hz", "500Hz", "5kHz", "20kHz"];

/**
 * Resample the bins array to exactly `width` entries via linear interpolation.
 *
 * The spectrum worker publishes a fixed number of columns (64), but the
 * terminal width varies. This stretches or compresses the bins to fill
 * the available space without aliasing artifacts.
 */
const mapBinsToWidth = (bins: number[], width: number): number[] => {
    if (width <= 0) {
        return [];
    }
    if (bins.length === 0) {
        return new Array<number>(width).fill(0);
    }
    if (bins.length === width) {
        return [...bins];
    }
    const result: number[] = [];
    for (let i = 0; i < width; i++) {
        const srcIdx = (i / width) * bins.length;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(bins.length - 1, lo + 1);
        const t = srcIdx - lo;
        result.push(bins[lo] * (1 - t) + bins[hi] * t);
    }
    return result;
};

/**
 * Build one column's worth of cells (top to bottom) as chalk-colored strings.
 *
 * Uses graduated Unicode block characters (░ ▒ ▓ █) so the bar tip fades
 * in rather than popping a full block — gives the illusion of sub-character
 * vertical resolution. Color is determined by horizontal position (low
 * frequencies blue, highs red-orange) via the spectrum gradient.
 *
 * @param normalizedHeight - Bar height 0–1
 * @param totalRows - Available content rows in the pane
 * @param colPosition - Horizontal position 0–1, used for color gradient
 */
const buildColumn = (
    normalizedHeight: number,
    totalRows: number,
    colPosition: number
): string[] => {
    const barRows = Math.round(normalizedHeight * totalRows);
    const cells: string[] = [];
    const [r, g, b] = spectrumColor(colPosition);

    for (let row = 0; row < totalRows; row++) {
        const rowFromBottom = totalRows - 1 - row;
        if (rowFromBottom >= barRows) {
            cells.push(" ");
        } else {
            // Top cell of the bar gets the lightest fill (░), inner cells get
            // progressively denser fill toward the bottom (▒ → ▓ → █).
            const levelIdx =
                rowFromBottom === barRows - 1
                    ? 1
                    : Math.min(
                          SPECTRUM_LEVELS - 1,
                          Math.floor((rowFromBottom / barRows) * SPECTRUM_LEVELS) + 1
                      );
            cells.push(chalk.rgb(r, g, b)(SPECTRUM_CHARS[levelIdx]));
        }
    }
    return cells;
};

/** Spread four frequency labels across `width` characters. */
const buildFreqLabel = (width: number): string => {
    const [lo, midLo, midHi, hi] = FREQ_LABELS;
    const spacing = Math.floor(width / 3);
    const raw =
        lo +
        midLo.padStart(spacing - lo.length + midLo.length) +
        midHi.padStart(spacing - midLo.length + midHi.length) +
        hi.padEnd(width - spacing * 2 - lo.length - midLo.length);
    return raw.slice(0, width).padEnd(width);
};

/**
 * Frequency spectrum display with box-drawing border.
 *
 * Memoized because the parent re-renders at 30fps for all subscriptions,
 * but the spectrum bins only change when spectrum-worker publishes new data.
 * Memo prevents re-building the grid string when only the waveform or
 * metadata changed.
 */
export const SpectrumPane: React.FC<SpectrumPaneProps> = memo(({ bins, width, height }) => {
    // width is the full pane width including borders; inner is content area.
    const innerWidth = Math.max(0, width - 2);

    if (innerWidth < MIN_INNER_WIDTH || height < 1) {
        return null;
    }

    const mappedBins = mapBinsToWidth(bins, innerWidth);
    const borderColor = chalk.rgb(100, 140, 200);

    // Build grid[row][col] = chalk string for that cell.
    const grid: string[][] = Array.from({ length: height }, () =>
        new Array<string>(innerWidth).fill(" ")
    );

    for (let col = 0; col < innerWidth; col++) {
        const normalizedHeight = mappedBins[col] ?? 0;
        const colPosition = innerWidth > 1 ? col / (innerWidth - 1) : 0;
        const colCells = buildColumn(normalizedHeight, height, colPosition);
        for (let row = 0; row < height; row++) {
            grid[row][col] = colCells[row];
        }
    }

    const topDashes = "═".repeat(Math.max(0, width - 13));
    const bottomDashes = "═".repeat(Math.max(0, width - 2));
    const freqLabel = buildFreqLabel(innerWidth);

    return (
        <Box flexDirection="column">
            {/* Top border */}
            <Text>{borderColor(`╔═ SPECTRUM ${topDashes}╗`)}</Text>
            {/* Content rows */}
            {grid.map((row, rowIdx) => (
                <Text key={rowIdx}>
                    {borderColor("║")}
                    {row.join("")}
                    {borderColor("║")}
                </Text>
            ))}
            {/* Frequency labels */}
            <Text>
                {borderColor("║")}
                {chalk.dim(freqLabel)}
                {borderColor("║")}
            </Text>
            {/* Bottom border */}
            <Text>{borderColor(`╚${bottomDashes}╝`)}</Text>
        </Box>
    );
});

SpectrumPane.displayName = "SpectrumPane";
