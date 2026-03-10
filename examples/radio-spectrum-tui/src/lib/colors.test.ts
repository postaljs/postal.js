/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { lerpColor, spectrumColor, vuColor } from "./colors.js";

describe("colors", () => {
    describe("lerpColor", () => {
        describe("when t is 0", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = lerpColor([0, 80, 220], [220, 60, 0], 0);
            });

            it("should return the first color exactly", () => {
                expect(result).toEqual([0, 80, 220]);
            });
        });

        describe("when t is 1", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = lerpColor([0, 80, 220], [220, 60, 0], 1);
            });

            it("should return the second color exactly", () => {
                expect(result).toEqual([220, 60, 0]);
            });
        });

        describe("when t is 0.5", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = lerpColor([0, 0, 0], [200, 200, 200], 0.5);
            });

            it("should return the midpoint color", () => {
                expect(result).toEqual([100, 100, 100]);
            });
        });
    });

    describe("spectrumColor", () => {
        describe("when position is 0 (sub-bass, first gradient stop)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = spectrumColor(0);
            });

            it("should return the first gradient stop color (deep blue)", () => {
                expect(result).toEqual([0, 80, 220]);
            });
        });

        describe("when position is 1 (highs, last gradient stop)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = spectrumColor(1);
            });

            it("should return the last gradient stop color (red-orange)", () => {
                expect(result).toEqual([220, 60, 0]);
            });
        });

        describe("when position is negative (below valid range)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = spectrumColor(-5);
            });

            it("should clamp to the first gradient stop", () => {
                expect(result).toEqual([0, 80, 220]);
            });
        });

        describe("when position is greater than 1 (above valid range)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = spectrumColor(999);
            });

            it("should clamp to the last gradient stop", () => {
                expect(result).toEqual([220, 60, 0]);
            });
        });

        describe("when position is 0.5 (mid-gradient, interpolates between stops 1 and 2)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                // 0.5 * (5 - 1) = 2.0, so lo=2, hi=2, t=0 → exactly stop [2] = [0, 220, 80]
                result = spectrumColor(0.5);
            });

            it("should return an RGB triple with all values in [0, 255]", () => {
                expect(result[0]).toBeGreaterThanOrEqual(0);
                expect(result[0]).toBeLessThanOrEqual(255);
                expect(result[1]).toBeGreaterThanOrEqual(0);
                expect(result[1]).toBeLessThanOrEqual(255);
                expect(result[2]).toBeGreaterThanOrEqual(0);
                expect(result[2]).toBeLessThanOrEqual(255);
            });

            it("should land exactly on the green stop (mids)", () => {
                // position 0.5 * 4 stops = 2.0 exactly → lo=2, hi=2, t=0 → [0, 220, 80]
                expect(result).toEqual([0, 220, 80]);
            });
        });

        describe("when position is 0.25 (interpolates between stops 0 and 1)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                // 0.25 * 4 = 1.0 exactly → lo=1, hi=1, t=0 → [0, 200, 220]
                result = spectrumColor(0.25);
            });

            it("should land on the cyan stop (bass)", () => {
                expect(result).toEqual([0, 200, 220]);
            });
        });
    });

    describe("vuColor", () => {
        describe("when level is in the green zone (< 0.6)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = vuColor(0.0);
            });

            it("should return a fully green color at the low end", () => {
                expect(result).toEqual([0, 200, 0]);
            });
        });

        describe("when level is exactly at the green/yellow boundary (0.6)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                // level === 0.6 falls to the second branch (level < 0.85)
                result = vuColor(0.6);
            });

            it("should return the yellow-green start color (second branch, t=0)", () => {
                // level 0.6: (0.6 - 0.6) / 0.25 = 0 → lerpColor([180,220,0], [220,160,0], 0)
                expect(result).toEqual([180, 220, 0]);
            });
        });

        describe("when level is in the yellow zone (>= 0.6 and < 0.85)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = vuColor(0.7);
            });

            it("should return an RGB triple with all values in [0, 255]", () => {
                expect(result[0]).toBeGreaterThanOrEqual(0);
                expect(result[0]).toBeLessThanOrEqual(255);
                expect(result[1]).toBeGreaterThanOrEqual(0);
                expect(result[1]).toBeLessThanOrEqual(255);
                expect(result[2]).toBeGreaterThanOrEqual(0);
                expect(result[2]).toBeLessThanOrEqual(255);
            });
        });

        describe("when level is at or above the red threshold (>= 0.85)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = vuColor(0.85);
            });

            it("should return the red-orange start color (third branch, t=0)", () => {
                // level 0.85: (0.85 - 0.85) / 0.15 = 0 → lerpColor([220,80,0], [255,0,0], 0)
                expect(result).toEqual([220, 80, 0]);
            });
        });

        describe("when level is 1.0 (clipping, top of red zone)", () => {
            let result: [number, number, number];

            beforeEach(() => {
                result = vuColor(1.0);
            });

            it("should return pure red (r=255, g=0, b=0)", () => {
                // (1.0 - 0.85) / 0.15 = 1.0 → lerpColor([220,80,0], [255,0,0], 1)
                // Math.round(-0) produces -0 in JS, which is numerically equal to 0.
                // toBeCloseTo handles this correctly; toEqual would fail on -0 vs 0.
                expect(result[0]).toBeCloseTo(255, 5);
                expect(result[1]).toBeCloseTo(0, 5);
                expect(result[2]).toBeCloseTo(0, 5);
            });
        });
    });
});
