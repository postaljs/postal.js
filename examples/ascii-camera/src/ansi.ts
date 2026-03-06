// ANSI escape sequence utilities for terminal rendering.
// Pure string builders — no stdout writes here. The renderer owns all output
// so it can batch into a single write per frame and avoid flicker.

/** Enter the alternate screen buffer — preserves the user's existing terminal content. */
export const enterAltScreen = (): string => `\x1b[?1049h`;

/** Exit the alternate screen buffer and restore the original. */
export const exitAltScreen = (): string => `\x1b[?1049l`;

/** Hide the cursor — prevents flicker during rapid redraws. */
export const hideCursor = (): string => `\x1b[?25l`;

/** Show the cursor again — always call on exit. */
export const showCursor = (): string => `\x1b[?25h`;

/** Move cursor to home position (top-left). Used to overwrite the previous frame in-place. */
export const cursorHome = (): string => `\x1b[H`;

/** Clear from cursor to end of screen. */
export const clearToEnd = (): string => `\x1b[J`;

/** Move cursor to (row, col), both 1-indexed as ANSI expects. */
export const moveTo = (row: number, col: number): string => `\x1b[${row};${col}H`;

/** Erase the current line entirely and move cursor to column 1. */
export const eraseLine = (): string => `\x1b[2K\r`;

/** Reset all SGR attributes. */
export const reset = (): string => `\x1b[0m`;

/** Dim text — used for separator lines in the HUD. */
export const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

/** Bold text — used for HUD values. */
export const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;

/** Truecolor (24-bit) foreground. Each channel is 0–255. */
export const fg = (r: number, g: number, b: number, s: string): string =>
    `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;

/** Truecolor (24-bit) foreground applied to a single character — no trailing reset.
 *  Used by the ASCII color renderer which resets once at end-of-line to reduce output size. */
export const fgChar = (r: number, g: number, b: number, ch: string): string =>
    `\x1b[38;2;${r};${g};${b}m${ch}`;
