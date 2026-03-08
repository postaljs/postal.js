// WaveformPane — scrolling amplitude envelope inside a box-drawing border.
//
// Renders a mirrored bar from center outward (SoundCloud-style envelope),
// not an oscilloscope trace. Much more readable at this character resolution.
// Fixed 5-row height, same as the original display.ts.

import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { WAVEFORM_CHARS } from "../lib/bar-characters.js";

export type WaveformPaneProps = {
    /** Scrolling buffer of peak amplitude values (0–1), newest at the end. */
    samples: number[];
    /** Full pane width including box-drawing borders. */
    width: number;
};

const WAVEFORM_HEIGHT = 5;
// Amplify the signal so ambient music (typically 0.1–0.3 peak) fills the
// display. Without gain, the waveform would be nearly flat for quiet genres.
const WAVEFORM_GAIN = 2.5;
const MIN_INNER_WIDTH = 10;

/**
 * Build a WAVEFORM_HEIGHT × innerWidth grid of Unicode characters representing
 * the amplitude envelope.
 *
 * Each column is a mirrored vertical bar expanding outward from the center row
 * (SoundCloud-style), using half-block characters (▄/▀) at the tips for smooth
 * sub-character transitions. The center row draws a thin horizontal line (─)
 * when no signal is present, giving the pane visual structure even during silence.
 */
const buildWaveformGrid = (samples: number[], innerWidth: number): string[][] => {
    const halfHeight = WAVEFORM_HEIGHT / 2;
    const midRow = Math.floor(WAVEFORM_HEIGHT / 2);

    // Right-align: pad left with zeros if buffer is shorter than innerWidth.
    const padded =
        samples.length >= innerWidth
            ? samples.slice(samples.length - innerWidth)
            : [...new Array<number>(innerWidth - samples.length).fill(0), ...samples];

    const grid: string[][] = Array.from({ length: WAVEFORM_HEIGHT }, () =>
        new Array<string>(innerWidth).fill(" ")
    );

    for (let col = 0; col < innerWidth; col++) {
        const amp = Math.min(1, (padded[col] ?? 0) * WAVEFORM_GAIN);
        const barHalf = amp * halfHeight;

        for (let row = 0; row < WAVEFORM_HEIGHT; row++) {
            const distFromCenter = Math.abs(row - midRow);
            if (distFromCenter < barHalf) {
                grid[row][col] = WAVEFORM_CHARS.FULL;
            } else if (distFromCenter < barHalf + 0.5) {
                grid[row][col] =
                    row < midRow ? WAVEFORM_CHARS.LOWER_HALF : WAVEFORM_CHARS.UPPER_HALF;
            }
        }

        // Always draw the center line if nothing else is there.
        if (grid[midRow][col] === " ") {
            grid[midRow][col] = WAVEFORM_CHARS.CENTER;
        }
    }

    return grid;
};

/**
 * Scrolling waveform amplitude envelope with box-drawing border.
 *
 * Not memoized — the parent passes `waveformBufferRef.current` which is the
 * same array reference mutated in place. React.memo would compare by reference
 * and never re-render. The 30fps throttle in usePostalSubscription is
 * sufficient to keep render cost reasonable.
 */
export const WaveformPane: React.FC<WaveformPaneProps> = ({ samples, width }) => {
    const innerWidth = Math.max(0, width - 2);

    if (innerWidth < MIN_INNER_WIDTH) {
        return null;
    }

    const grid = buildWaveformGrid(samples, innerWidth);
    const paneColor = chalk.rgb(80, 160, 120);
    const midRow = Math.floor(WAVEFORM_HEIGHT / 2);
    const topDashes = "═".repeat(Math.max(0, width - 13));
    const bottomDashes = "═".repeat(Math.max(0, width - 2));

    return (
        <Box flexDirection="column">
            <Text>{paneColor(`╔═ WAVEFORM ${topDashes}╗`)}</Text>
            {grid.map((row, rowIdx) => {
                const rowStr = row
                    .map(ch => {
                        if (ch === " ") {
                            return " ";
                        }
                        if (ch === WAVEFORM_CHARS.CENTER) {
                            return chalk.dim(WAVEFORM_CHARS.CENTER);
                        }
                        // Cyan gradient — brighter near center, dimmer at edges.
                        const distFromCenter = Math.abs(rowIdx - midRow);
                        const brightness = Math.max(80, 220 - distFromCenter * 60);
                        return chalk.rgb(0, brightness, brightness)(ch);
                    })
                    .join("");
                return (
                    <Text key={rowIdx}>
                        {paneColor("║")}
                        {rowStr}
                        {paneColor("║")}
                    </Text>
                );
            })}
            <Text>{paneColor(`╚${bottomDashes}╝`)}</Text>
        </Box>
    );
};
