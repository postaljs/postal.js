// Character palette for spectrum and waveform rendering.
//
// These are the same block characters used in the original display.ts,
// extracted here so components don't have to re-declare them.

/** 5-level vertical fill for spectrum bars (empty → full). */
export const SPECTRUM_CHARS = [" ", "░", "▒", "▓", "█"] as const;

/** Number of distinct fill levels in SPECTRUM_CHARS. */
export const SPECTRUM_LEVELS = SPECTRUM_CHARS.length;

/** Block characters used in the waveform pane. */
export const WAVEFORM_CHARS = {
    /** Full block — interior of the waveform bar. */
    FULL: "█",
    /** Lower half block — tip of the bar below center. */
    LOWER_HALF: "▄",
    /** Upper half block — tip of the bar above center. */
    UPPER_HALF: "▀",
    /** Horizontal rule — center line when no signal. */
    CENTER: "─",
} as const;
