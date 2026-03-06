/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import {
    FLAP_CHARS,
    FLAP_TIMING,
    createSplitFlapAnimation,
    animationDurationMs,
} from "./split-flap.js";

// The animation timing constants used throughout so tests stay in sync
// with the implementation if FLAP_TIMING ever changes.
const { FLIP_INTERVAL_MS, STAGGER_MS } = FLAP_TIMING;

describe("split-flap", () => {
    describe("createSplitFlapAnimation", () => {
        describe("when current and target are identical", () => {
            let frame: string;
            let complete: boolean;

            beforeEach(() => {
                const anim = createSplitFlapAnimation("ON TIME  ", "ON TIME  ", 9, 0);
                frame = anim.getFrame(0);
                complete = anim.isComplete(0);
            });

            it("should immediately return the target string", () => {
                expect(frame).toBe("ON TIME  ");
            });

            it("should be complete immediately", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when current is shorter than width", () => {
            let frame: string;

            beforeEach(() => {
                // "AB" padded to width 5 → "AB   "
                const anim = createSplitFlapAnimation("AB", "AB   ", 5, 0);
                frame = anim.getFrame(0);
            });

            it("should pad current to the full width", () => {
                // All chars the same so animation is complete immediately
                expect(frame).toBe("AB   ");
            });
        });

        describe("when target is longer than width", () => {
            let frame: string;
            let complete: boolean;

            beforeEach(() => {
                // Target "BOARDING NOW" truncated to width 9 → "BOARDING "
                const anim = createSplitFlapAnimation("ON TIME  ", "BOARDING NOW", 9, 0);
                // Jump well past all flips to see the final landed frame
                const farFuture = 999999;
                frame = anim.getFrame(farFuture);
                complete = anim.isComplete(farFuture);
            });

            it("should truncate target to width", () => {
                expect(frame).toBe("BOARDING ");
            });

            it("should be complete when enough time has passed", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when animating from 'ON TIME' to 'BOARDING'", () => {
            const WIDTH = 9;
            const START_MS = 1000;
            let anim: ReturnType<typeof createSplitFlapAnimation>;

            beforeEach(() => {
                anim = createSplitFlapAnimation("ON TIME  ", "BOARDING ", WIDTH, START_MS);
            });

            it("should not be complete at start", () => {
                expect(anim.isComplete(START_MS)).toBe(false);
            });

            it("should expose the padded target", () => {
                expect(anim.target).toBe("BOARDING ");
            });

            it("should return the source string before any flip has occurred", () => {
                // At exactly START_MS, elapsed=0 so no flips yet
                const frame = anim.getFrame(START_MS);
                expect(frame).toBe("ON TIME  ");
            });

            it("should cycle the first character before later characters start", () => {
                // At START_MS + FLIP_INTERVAL_MS/2 only position 0 has moved one flip.
                // Position 1 hasn't started its stagger yet if STAGGER_MS > FLIP_INTERVAL_MS/2.
                // Just verify position 0 is no longer 'O' after enough flips.
                const afterFirstFlip = START_MS + FLIP_INTERVAL_MS + 1;
                const frame = anim.getFrame(afterFirstFlip);
                // Position 0: from 'O' (index 14), one flip → 'P'
                expect(frame[0]).toBe("P");
            });

            it("should stagger: position 1 starts STAGGER_MS after position 0", () => {
                // Right before position 1 starts, position 1 should still show its original char.
                const justBeforePos1Starts = START_MS + STAGGER_MS - 1;
                const frame = anim.getFrame(justBeforePos1Starts);
                // Position 1: from 'N', hasn't started → still 'N'
                expect(frame[1]).toBe("N");
            });

            it("should land on the full target string when complete", () => {
                const farFuture = START_MS + animationDurationMs(WIDTH) + 5000;
                expect(anim.getFrame(farFuture)).toBe("BOARDING ");
            });

            it("should be complete when all positions have landed", () => {
                const farFuture = START_MS + animationDurationMs(WIDTH) + 5000;
                expect(anim.isComplete(farFuture)).toBe(true);
            });
        });

        describe("when a position has the same character in source and target", () => {
            let frame: string;

            beforeEach(() => {
                // "AB" → "AC": position 0 ('A') doesn't change, position 1 does.
                const anim = createSplitFlapAnimation("AB", "AC", 2, 0);
                // After one flip interval, position 1 should have flipped once.
                frame = anim.getFrame(FLIP_INTERVAL_MS + STAGGER_MS + 1);
            });

            it("should leave unchanged positions on their character immediately", () => {
                // Position 0 ('A' → 'A') stays 'A' throughout.
                expect(frame[0]).toBe("A");
            });
        });
    });

    describe("animationDurationMs", () => {
        describe("when calculating duration for a single character", () => {
            let duration: number;

            beforeEach(() => {
                duration = animationDurationMs(1);
            });

            it("should return the maximum flips times the flip interval", () => {
                const expected = 0 + FLAP_CHARS.length * FLIP_INTERVAL_MS;
                expect(duration).toBe(expected);
            });
        });

        describe("when calculating duration for multiple characters", () => {
            let duration: number;

            beforeEach(() => {
                duration = animationDurationMs(9);
            });

            it("should include the stagger offset for the last position", () => {
                const expected = 8 * STAGGER_MS + FLAP_CHARS.length * FLIP_INTERVAL_MS;
                expect(duration).toBe(expected);
            });
        });

        describe("when width is zero", () => {
            let duration: number;

            beforeEach(() => {
                duration = animationDurationMs(0);
            });

            it("should return a value dominated by FLAP_CHARS.length * FLIP_INTERVAL_MS despite (width-1) underflow", () => {
                // (0 - 1) * STAGGER_MS is -STAGGER_MS, but FLAP_CHARS.length * FLIP_INTERVAL_MS
                // dominates, so the result is positive but semantically meaningless.
                const expected = -1 * STAGGER_MS + FLAP_CHARS.length * FLIP_INTERVAL_MS;
                expect(duration).toBe(expected);
            });
        });
    });

    describe("createSplitFlapAnimation — additional edge cases", () => {
        describe("when width is zero", () => {
            let frame: string, complete: boolean;

            beforeEach(() => {
                const anim = createSplitFlapAnimation("BOARDING", "ON TIME", 0, 0);
                frame = anim.getFrame(0);
                complete = anim.isComplete(0);
            });

            it("should return an empty string for every frame", () => {
                expect(frame).toBe("");
            });

            it("should be complete immediately", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when target requires a wrap-around in the character set", () => {
            let frame: string;

            beforeEach(() => {
                // '█' is the last character in FLAP_CHARS; 'A' is index 0.
                // Going from '█' (last) to 'B' (index 1) wraps around: length - lastIdx + 1 flips.
                // Width=1 so only one character position.
                const anim = createSplitFlapAnimation("█", "B", 1, 0);
                // One flip past the start of position 0 — should show 'A' (index 0 after wrap).
                frame = anim.getFrame(FLIP_INTERVAL_MS + 1);
            });

            it("should cycle through the wrap-around correctly", () => {
                // After one flip from '█' (last index), wraps to index 0 → 'A'.
                expect(frame).toBe("A");
            });
        });

        describe("when a character in the input is not in FLAP_CHARS", () => {
            let frame: string, complete: boolean;

            beforeEach(() => {
                // '?' is not in FLAP_CHARS — flapIndex maps it to 0 ('A').
                // Target is also '?', both map to index 0, so flips = 0, done immediately.
                const anim = createSplitFlapAnimation("?", "?", 1, 0);
                frame = anim.getFrame(0);
                complete = anim.isComplete(0);
            });

            it("should not crash and should treat the character as index 0", () => {
                // Both map to index 0, so the animation treats them as identical — done immediately.
                expect(complete).toBe(true);
            });

            it("should show the target character in the frame", () => {
                expect(frame).toBe("?");
            });
        });

        describe("when current is the last character in FLAP_CHARS and target is the same character", () => {
            let complete: boolean;

            beforeEach(() => {
                // '█' → '█': same index, zero flips, immediately done.
                const anim = createSplitFlapAnimation("█", "█", 1, 0);
                complete = anim.isComplete(0);
            });

            it("should be complete immediately with no cycling", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when a character position has not yet started due to stagger", () => {
            let frame: string;

            beforeEach(() => {
                // Width 2: position 1 starts at startMs + 1 * STAGGER_MS.
                // Query at exactly startMs (elapsed=0 for pos 0, elapsed<0 for pos 1) — pos 1 shows 'from'.
                // "AB" → "CD": pos 0: A→C, pos 1: B→D.
                const START = 5000;
                const anim = createSplitFlapAnimation("AB", "CD", 2, START);
                // Query at START + 0: pos 0 has elapsed=0 (no flips yet), pos 1 elapsed=-STAGGER_MS (negative).
                frame = anim.getFrame(START);
            });

            it("should show the source character for positions whose stagger has not elapsed", () => {
                // Both positions at elapsed=0: pos 0 shows 'A' (0 flips done), pos 1 shows 'B' (elapsed<0).
                expect(frame).toBe("AB");
            });
        });

        describe("when a single character cycles exactly to the target flip count boundary", () => {
            let frame: string, complete: boolean;

            beforeEach(() => {
                // 'A' (index 0) → 'C' (index 2): 2 flips needed.
                // At exactly 2 * FLIP_INTERVAL_MS elapsed, flipsDone = 2 >= totalFlips = 2 → landed.
                const anim = createSplitFlapAnimation("A", "C", 1, 0);
                const exactLandingMs = 2 * FLIP_INTERVAL_MS;
                frame = anim.getFrame(exactLandingMs);
                complete = anim.isComplete(exactLandingMs);
            });

            it("should show the target character at the exact landing moment", () => {
                expect(frame).toBe("C");
            });

            it("should be complete at the exact landing moment", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when target is all spaces (empty-looking destination)", () => {
            let frame: string, complete: boolean;

            beforeEach(() => {
                // Animating from "BOARDING " to "         " (all spaces, width=9).
                // ' ' is in FLAP_CHARS at index 26.
                const anim = createSplitFlapAnimation("BOARDING ", "         ", 9, 0);
                const farFuture = 999999;
                frame = anim.getFrame(farFuture);
                complete = anim.isComplete(farFuture);
            });

            it("should land on a fully-space string", () => {
                expect(frame).toBe("         ");
            });

            it("should be complete", () => {
                expect(complete).toBe(true);
            });
        });

        describe("when getFrame is called with a time before the animation start", () => {
            let frame: string;

            beforeEach(() => {
                // Start at 10000ms, query at 5000ms — all positions show 'from'.
                const anim = createSplitFlapAnimation("AB", "CD", 2, 10000);
                frame = anim.getFrame(5000);
            });

            it("should return the source string unchanged", () => {
                expect(frame).toBe("AB");
            });
        });
    });
});
