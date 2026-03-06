// ASCII conversion: raw RGB24 pixels → printable strings.
//
// Each frame from ffmpeg is a flat Uint8Array of [R, G, B, R, G, B, ...] bytes,
// width × height × 3 bytes total. We map each pixel's luminance to a character
// from CHAR_RAMP and optionally wrap it in a 24-bit ANSI color escape.

import { fgChar, reset } from "./ansi.ts";

// Characters ordered dark → light. Wider ramp = smoother gradients.
// The leading space is intentional — luminance 0 maps to a blank cell.
export const CHAR_RAMP = " .:-=+*%#@";

/**
 * Compute perceived luminance from an RGB triple using the standard
 * Rec. 601 coefficients. Result is in [0, 255].
 */
export const luminance = (r: number, g: number, b: number): number =>
    0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Map a luminance value [0, 255] to a character from CHAR_RAMP.
 * Higher luminance → characters later in the ramp (denser/brighter looking).
 */
export const lumToChar = (lum: number): string => {
    const raw = Math.floor((lum / 255) * (CHAR_RAMP.length - 1));
    const index = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(CHAR_RAMP.length - 1, raw));
    return CHAR_RAMP[index];
};

/**
 * Build a monochrome ASCII frame string from a raw RGB24 buffer.
 *
 * Each row becomes a line of characters; rows are separated by newlines.
 * No trailing newline — the renderer adds one before the HUD.
 */
export const buildMonoFrame = (buf: Uint8Array, width: number, height: number): string => {
    const rows: string[] = [];

    for (let y = 0; y < height; y++) {
        let row = "";
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 3;
            const r = buf[offset];
            const g = buf[offset + 1];
            const b = buf[offset + 2];
            row += lumToChar(luminance(r, g, b));
        }
        rows.push(row);
    }

    return rows.join("\n");
};

// Quantize a channel to the nearest step — reduces the number of unique
// colors so adjacent pixels are more likely to share an escape sequence.
const Q_STEP = 8;
const quantize = (v: number): number => Math.round(v / Q_STEP) * Q_STEP;

/**
 * Build a color ASCII frame string from a raw RGB24 buffer.
 *
 * Same as mono but each character is wrapped in a 24-bit ANSI foreground
 * sequence. We only emit a new escape when the quantized color changes from
 * the previous pixel — in a typical camera frame most adjacent pixels share
 * similar colors, so this cuts the output size substantially.
 */
export const buildColorFrame = (buf: Uint8Array, width: number, height: number): string => {
    const rows: string[] = [];

    for (let y = 0; y < height; y++) {
        let row = "";
        let prevR = -1;
        let prevG = -1;
        let prevB = -1;

        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 3;
            const r = buf[offset];
            const g = buf[offset + 1];
            const b = buf[offset + 2];
            const ch = lumToChar(luminance(r, g, b));

            const qr = quantize(r);
            const qg = quantize(g);
            const qb = quantize(b);

            if (qr !== prevR || qg !== prevG || qb !== prevB) {
                row += fgChar(qr, qg, qb, ch);
                prevR = qr;
                prevG = qg;
                prevB = qb;
            } else {
                row += ch;
            }
        }
        row += reset();
        rows.push(row);
    }

    return rows.join("\n");
};
