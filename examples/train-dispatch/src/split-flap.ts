// Split-flap animation engine.
//
// The mechanical split-flap display effect: when a cell's value changes,
// each character independently cycles through the character set before
// landing on the target. Left-to-right stagger gives the "rattling" feel.
//
// Callers poll getFrame() on each render tick. When isComplete() is true,
// the animation is done and the cell can stop animating.

/** The ordered character set each position cycles through. */
export const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 +-:░▓█";

/** Animation timing constants — tune these in task 9. */
export const FLAP_TIMING = {
    /** Real milliseconds between each character flip in a single position. */
    FLIP_INTERVAL_MS: 40,
    /** Additional ms each successive character position is delayed (stagger). */
    STAGGER_MS: 15,
} as const;

/** Per-character animation state. */
type CharAnimation = {
    /** The character we started from. */
    from: string;
    /** The character we need to land on. */
    to: string;
    /** When this position's animation begins (ms from animation start). */
    startMs: number;
    /** How many flips until we land on `to`. */
    totalFlips: number;
    /** Which flip we're currently on. */
    currentFlip: number;
    /** Whether this position has finished. */
    done: boolean;
};

export type SplitFlapAnimation = {
    /** Returns the current visible string for this frame. */
    getFrame: (nowMs: number) => string;
    /** True when all character positions have landed. */
    isComplete: (nowMs: number) => boolean;
    /** The target string this animation is heading toward. */
    target: string;
};

/**
 * Finds the index of a character in the flap set.
 * Unknown characters map to index 0 (space area) so we don't crash.
 */
const flapIndex = (ch: string): number => {
    const idx = FLAP_CHARS.indexOf(ch.toUpperCase());
    return idx === -1 ? 0 : idx;
};

/**
 * Counts how many flips are needed to get from `from` to `to` in the
 * character set, wrapping around if necessary.
 */
const flipsNeeded = (from: string, to: string): number => {
    const fromIdx = flapIndex(from);
    const toIdx = flapIndex(to);
    if (fromIdx === toIdx) {
        return 0;
    }
    // Real split-flap displays can only rotate forward — the drum is driven
    // by a one-way ratchet and cannot reverse. Always use the forward distance
    // even when the shorter path would be backwards.
    return toIdx > fromIdx ? toIdx - fromIdx : FLAP_CHARS.length - fromIdx + toIdx;
};

/**
 * Creates a split-flap animation from `current` string to `target` string.
 *
 * Both strings are padded or truncated to `width` before animating so the
 * caller never has to worry about length mismatches.
 */
export const createSplitFlapAnimation = (
    current: string,
    target: string,
    width: number,
    startMs: number
): SplitFlapAnimation => {
    // Normalise both strings to exactly `width` characters, uppercase.
    const pad = (s: string): string => s.toUpperCase().padEnd(width, " ").slice(0, width);
    const from = pad(current);
    const to = pad(target);

    // Build per-character animation state. Positions that don't change get
    // done:true immediately so they never cycle.
    const chars: CharAnimation[] = Array.from({ length: width }, (_, i) => {
        const flips = flipsNeeded(from[i], to[i]);
        return {
            from: from[i],
            to: to[i],
            startMs: startMs + i * FLAP_TIMING.STAGGER_MS,
            totalFlips: flips,
            currentFlip: 0,
            done: flips === 0,
        };
    });

    const getCharAt = (char: CharAnimation, nowMs: number): string => {
        if (char.done) {
            return char.to;
        }
        const elapsed = nowMs - char.startMs;
        if (elapsed < 0) {
            // This position hasn't started yet — show the current character.
            return char.from;
        }
        const flipsDone = Math.floor(elapsed / FLAP_TIMING.FLIP_INTERVAL_MS);
        if (flipsDone >= char.totalFlips) {
            // Landed.
            return char.to;
        }
        const charIdx = (flapIndex(char.from) + flipsDone) % FLAP_CHARS.length;
        return FLAP_CHARS[charIdx];
    };

    const isCharDone = (char: CharAnimation, nowMs: number): boolean => {
        if (char.done) {
            return true;
        }
        const elapsed = nowMs - char.startMs;
        return elapsed >= char.totalFlips * FLAP_TIMING.FLIP_INTERVAL_MS;
    };

    return {
        target: to,

        getFrame(nowMs: number): string {
            return chars.map(c => getCharAt(c, nowMs)).join("");
        },

        isComplete(nowMs: number): boolean {
            return chars.every(c => isCharDone(c, nowMs));
        },
    };
};

/**
 * Calculates the total animation duration for a string of `width` characters.
 * Useful for callers who want to know when an animation will finish.
 */
export const animationDurationMs = (width: number): number => {
    // Worst case: last position starts at (width-1)*STAGGER_MS and then
    // needs at most FLAP_CHARS.length flips.
    return (width - 1) * FLAP_TIMING.STAGGER_MS + FLAP_CHARS.length * FLAP_TIMING.FLIP_INTERVAL_MS;
};
