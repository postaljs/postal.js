// ANSI escape sequence utilities.
// Pure string builders — no stdout writes here. The display module
// owns all output so we can buffer into a single write per frame.

/** Move cursor to (row, col), both 1-indexed as ANSI expects. */
export const moveTo = (row: number, col: number): string => `\x1b[${row};${col}H`;

/** Clear from cursor to end of line. */
export const clearToEol = (): string => `\x1b[0K`;

/** Enter the alternate screen buffer so we don't trash the user's terminal. */
export const enterAltScreen = (): string => `\x1b[?1049h`;

/** Exit the alternate screen buffer and restore the original. */
export const exitAltScreen = (): string => `\x1b[?1049l`;

/** Hide the cursor — prevents flicker during rapid redraws. */
export const hideCursor = (): string => `\x1b[?25l`;

/** Show the cursor again — always call this on exit. */
export const showCursor = (): string => `\x1b[?25h`;

/** Clear the entire screen. */
export const clearScreen = (): string => `\x1b[2J`;

// --- Color helpers using SGR (Select Graphic Rendition) ---

/** Reset all attributes. */
export const reset = (): string => `\x1b[0m`;

/** Bold text. */
export const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;

/** Dim text (slightly darker). */
export const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;

/** Truecolor foreground: r, g, b each 0–255. */
export const fg = (r: number, g: number, b: number, s: string): string =>
    `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;

/** Truecolor background: r, g, b each 0–255. */
export const bg = (r: number, g: number, b: number, s: string): string =>
    `\x1b[48;2;${r};${g};${b}m${s}\x1b[0m`;

/** Combined foreground + background (avoids nested resets). */
export const color = (
    fgR: number,
    fgG: number,
    fgB: number,
    bgR: number,
    bgG: number,
    bgB: number,
    s: string
): string => `\x1b[38;2;${fgR};${fgG};${fgB}m\x1b[48;2;${bgR};${bgG};${bgB}m${s}\x1b[0m`;

// --- Board-specific color palette ---
// Departure boards are typically black background, amber/yellow text.

/** Amber text on black — the classic departure board look. */
export const amber = (s: string): string => fg(255, 191, 0, s);

/** Bright white — used for headers and emphasis. */
export const white = (s: string): string => fg(240, 240, 240, s);

/** Dimmed amber — landed cells look slightly less bright than cycling ones. */
export const amberDim = (s: string): string => fg(180, 130, 0, s);

/** Bright cycling color — characters mid-flip look brighter. */
export const amberBright = (s: string): string => fg(255, 220, 60, s);

/** Green — used for ON TIME status. */
export const green = (s: string): string => fg(80, 220, 80, s);

/** Red — used for DELAYED / HELD status. */
export const red = (s: string): string => fg(220, 80, 80, s);

/** Cyan — used for BOARDING status. */
export const cyan = (s: string): string => fg(80, 200, 220, s);

/** Gray — used for DEPARTED. */
export const gray = (s: string): string => fg(120, 120, 120, s);

/** Blue — used for EXPECTED. */
export const blue = (s: string): string => fg(100, 160, 255, s);

/** Box-drawing characters for the board frame. */
export const BOX = {
    TL: "╔",
    TR: "╗",
    BL: "╚",
    BR: "╝",
    H: "═",
    V: "║",
    TM: "╦",
    BM: "╩",
    LM: "╠",
    RM: "╣",
    X: "╬",
} as const;
