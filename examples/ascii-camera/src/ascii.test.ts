/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { CHAR_RAMP, luminance, lumToChar, buildMonoFrame, buildColorFrame } from "./ascii.js";

// ANSI reset sequence that buildColorFrame appends at end of each row.
const ANSI_RESET = "\x1b[0m";

// Helper: create a flat RGB24 buffer for a single pixel.
const pixelBuf = (r: number, g: number, b: number): Uint8Array => new Uint8Array([r, g, b]);

// Helper: create a 2-pixel RGB24 buffer.
const twoPxBuf = (
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number
): Uint8Array => new Uint8Array([r1, g1, b1, r2, g2, b2]);

describe("ascii", () => {
    describe("luminance", () => {
        describe("when all channels are zero (pure black)", () => {
            let result: number;

            beforeEach(() => {
                result = luminance(0, 0, 0);
            });

            it("should return 0", () => {
                expect(result).toBe(0);
            });
        });

        describe("when all channels are at maximum (pure white)", () => {
            let result: number;

            beforeEach(() => {
                result = luminance(255, 255, 255);
            });

            it("should return 255", () => {
                expect(result).toBeCloseTo(255, 1);
            });
        });

        describe("when only the green channel is at maximum", () => {
            let result: number;

            beforeEach(() => {
                result = luminance(0, 255, 0);
            });

            it("should apply the Rec.601 green coefficient (~0.587)", () => {
                // Pure green: 0.299×0 + 0.587×255 + 0.114×0 ≈ 149.685
                expect(result).toBeCloseTo(149.685, 1);
            });
        });

        describe("when only the red channel is at maximum", () => {
            let result: number;

            beforeEach(() => {
                result = luminance(255, 0, 0);
            });

            it("should apply the Rec.601 red coefficient (~0.299)", () => {
                expect(result).toBeCloseTo(76.245, 1);
            });
        });

        describe("when only the blue channel is at maximum", () => {
            let result: number;

            beforeEach(() => {
                result = luminance(0, 0, 255);
            });

            it("should apply the Rec.601 blue coefficient (~0.114)", () => {
                expect(result).toBeCloseTo(29.07, 1);
            });
        });
    });

    describe("lumToChar", () => {
        describe("when luminance is 0 (minimum)", () => {
            let result: string;

            beforeEach(() => {
                result = lumToChar(0);
            });

            it("should return the first character in the ramp (space)", () => {
                expect(result).toBe(CHAR_RAMP[0]);
            });
        });

        describe("when luminance is 255 (maximum)", () => {
            let result: string;

            beforeEach(() => {
                result = lumToChar(255);
            });

            it("should return the last character in the ramp", () => {
                expect(result).toBe(CHAR_RAMP.at(-1));
            });
        });

        describe("when luminance is at the midpoint (~128)", () => {
            let result: string;

            beforeEach(() => {
                result = lumToChar(128);
            });

            it("should return a character from the middle of the ramp", () => {
                const expectedIndex = Math.floor((128 / 255) * (CHAR_RAMP.length - 1));
                expect(result).toBe(CHAR_RAMP[expectedIndex]);
            });
        });

        describe("when luminance is negative (below-range input)", () => {
            let result: string;

            beforeEach(() => {
                result = lumToChar(-1);
            });

            it("should clamp to the first character in the ramp", () => {
                expect(result).toBe(CHAR_RAMP[0]);
            });
        });

        describe("when luminance is above 255 (over-range input)", () => {
            let result: string;

            beforeEach(() => {
                result = lumToChar(510);
            });

            it("should clamp to the last character in the ramp", () => {
                expect(result).toBe(CHAR_RAMP.at(-1));
            });
        });
    });

    describe("buildMonoFrame", () => {
        describe("when given a 0×0 frame (zero height)", () => {
            let result: string;

            beforeEach(() => {
                result = buildMonoFrame(new Uint8Array(0), 0, 0);
            });

            it("should return an empty string", () => {
                expect(result).toBe("");
            });
        });

        describe("when given a 1×1 black pixel", () => {
            let result: string;

            beforeEach(() => {
                result = buildMonoFrame(pixelBuf(0, 0, 0), 1, 1);
            });

            it("should return the darkest character (space)", () => {
                expect(result).toBe(CHAR_RAMP[0]);
            });

            it("should contain no newlines for a single row", () => {
                expect(result).not.toContain("\n");
            });
        });

        describe("when given a 1×1 white pixel", () => {
            let result: string;

            beforeEach(() => {
                result = buildMonoFrame(pixelBuf(255, 255, 255), 1, 1);
            });

            it("should return the brightest character", () => {
                expect(result).toBe(CHAR_RAMP.at(-1));
            });
        });

        describe("when given a 2×1 frame (two pixels in one row)", () => {
            let result: string;

            beforeEach(() => {
                // First pixel black, second pixel white
                result = buildMonoFrame(twoPxBuf(0, 0, 0, 255, 255, 255), 2, 1);
            });

            it("should produce two characters with no newline", () => {
                expect(result).toHaveLength(2);
                expect(result).not.toContain("\n");
            });

            it("should map each pixel to the correct character", () => {
                expect(result[0]).toBe(CHAR_RAMP[0]);
                expect(result[1]).toBe(CHAR_RAMP.at(-1));
            });
        });

        describe("when given a 1×2 frame (two rows of one pixel each)", () => {
            let result: string;

            beforeEach(() => {
                // Row 0: black pixel, Row 1: white pixel
                result = buildMonoFrame(twoPxBuf(0, 0, 0, 255, 255, 255), 1, 2);
            });

            it("should separate rows with a newline", () => {
                expect(result).toContain("\n");
            });

            it("should produce two rows", () => {
                const rows = result.split("\n");
                expect(rows).toHaveLength(2);
            });

            it("should map each row's pixel correctly", () => {
                const rows = result.split("\n");
                expect(rows[0]).toBe(CHAR_RAMP[0]);
                expect(rows[1]).toBe(CHAR_RAMP.at(-1));
            });

            it("should not have a trailing newline after the last row", () => {
                expect(result.endsWith("\n")).toBe(false);
            });
        });

        describe("when the buffer is shorter than the declared dimensions", () => {
            let result: string;

            beforeEach(() => {
                // Declare a 2×1 frame but supply only 1 pixel (3 bytes) — second pixel reads undefined
                result = buildMonoFrame(pixelBuf(128, 128, 128), 2, 1);
            });

            it("should clamp the out-of-bounds pixel to the darkest character rather than corrupting the frame", () => {
                // Out-of-bounds Uint8Array reads return undefined; luminance(undefined, ...) = NaN;
                // lumToChar(NaN) clamps to index 0 (space). No exception, no "undefined" string.
                expect(result).toHaveLength(2);
                expect(result[1]).toBe(CHAR_RAMP[0]);
            });
        });
    });

    describe("buildColorFrame", () => {
        describe("when given a 0×0 frame (zero height)", () => {
            let result: string;

            beforeEach(() => {
                result = buildColorFrame(new Uint8Array(0), 0, 0);
            });

            it("should return an empty string", () => {
                expect(result).toBe("");
            });
        });

        describe("when given a 1×1 pixel", () => {
            let result: string;

            beforeEach(() => {
                // A red pixel — vivid enough to verify the escape is present
                result = buildColorFrame(pixelBuf(200, 50, 50), 1, 1);
            });

            it("should contain an ANSI 24-bit foreground escape for the quantized pixel color", () => {
                // Colors are quantized to nearest 8 to reduce escape output.
                // (200, 50, 50) → (200, 48, 48)
                expect(result).toContain("\x1b[38;2;200;48;48m");
            });

            it("should end with an ANSI reset sequence", () => {
                expect(result.endsWith(ANSI_RESET)).toBe(true);
            });
        });

        describe("when given a 2×2 frame", () => {
            const W = 2;
            const H = 2;
            let result: string;

            beforeEach(() => {
                // 4 pixels: TL black, TR white, BL white, BR black
                const buf = new Uint8Array([
                    0,
                    0,
                    0, // row 0 col 0 — black
                    255,
                    255,
                    255, // row 0 col 1 — white
                    255,
                    255,
                    255, // row 1 col 0 — white
                    0,
                    0,
                    0, // row 1 col 1 — black
                ]);
                result = buildColorFrame(buf, W, H);
            });

            it("should separate rows with a newline", () => {
                expect(result).toContain("\n");
            });

            it("should produce the correct number of rows", () => {
                const rows = result.split("\n");
                expect(rows).toHaveLength(H);
            });

            it("should include a reset at the end of each row", () => {
                const rows = result.split("\n");
                for (const row of rows) {
                    expect(row.endsWith(ANSI_RESET)).toBe(true);
                }
            });

            it("should not have a trailing newline after the last row", () => {
                expect(result.endsWith("\n")).toBe(false);
            });
        });
    });
});
