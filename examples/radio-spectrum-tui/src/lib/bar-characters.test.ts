/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { SPECTRUM_CHARS, SPECTRUM_LEVELS, WAVEFORM_CHARS } from "./bar-characters.js";

describe("bar-characters", () => {
    describe("SPECTRUM_CHARS", () => {
        it("should export an array with 5 entries", () => {
            expect(SPECTRUM_CHARS.length).toBe(5);
        });

        it("should have an empty string as the first entry (empty fill)", () => {
            expect(SPECTRUM_CHARS[0]).toBe(" ");
        });

        it("should have a full block as the last entry (full fill)", () => {
            expect(SPECTRUM_CHARS[4]).toBe("█");
        });

        it("should have the expected fill characters in order", () => {
            expect(SPECTRUM_CHARS).toEqual([" ", "░", "▒", "▓", "█"]);
        });
    });

    describe("SPECTRUM_LEVELS", () => {
        it("should equal the length of SPECTRUM_CHARS", () => {
            expect(SPECTRUM_LEVELS).toBe(SPECTRUM_CHARS.length);
        });

        it("should be 5", () => {
            expect(SPECTRUM_LEVELS).toBe(5);
        });
    });

    describe("WAVEFORM_CHARS", () => {
        it("should export a FULL block character", () => {
            expect(WAVEFORM_CHARS.FULL).toBe("█");
        });

        it("should export a LOWER_HALF block character", () => {
            expect(WAVEFORM_CHARS.LOWER_HALF).toBe("▄");
        });

        it("should export an UPPER_HALF block character", () => {
            expect(WAVEFORM_CHARS.UPPER_HALF).toBe("▀");
        });

        it("should export a CENTER horizontal rule character", () => {
            expect(WAVEFORM_CHARS.CENTER).toBe("─");
        });
    });
});
