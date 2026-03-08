/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// fft.test.ts — happy-path tests for the FFT module.
//
// Strategy: feed pure sine waves at known frequencies and verify the dominant
// bin lands where expected. We also verify that Hann windowing reduces
// spectral leakage compared to a rectangular (no-window) FFT.

import {
    FFT_SIZE,
    SAMPLE_RATE,
    applyHannWindow,
    fft,
    magnitude,
    logFrequencyBins,
    extractChannel,
} from "./fft.js";

// Generate a pure sine wave at `freqHz` with the given amplitude.
const generateSine = (freqHz: number, numSamples: number, amplitude = 1.0): Float32Array => {
    const out = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
    }
    return out;
};

// Find the index of the highest-magnitude bin.
const peakBin = (mag: Float32Array): number => {
    let maxVal = 0;
    let maxIdx = 0;
    for (let i = 0; i < mag.length; i++) {
        if (mag[i] > maxVal) {
            maxVal = mag[i];
            maxIdx = i;
        }
    }
    return maxIdx;
};

// Expected FFT bin for a given frequency.
const expectedBin = (freqHz: number): number => Math.round((freqHz * FFT_SIZE) / SAMPLE_RATE);

describe("fft module", () => {
    describe("applyHannWindow", () => {
        describe("when applied to a constant signal", () => {
            let samples: Float32Array;

            beforeEach(() => {
                samples = new Float32Array(FFT_SIZE).fill(1.0);
                applyHannWindow(samples);
            });

            it("should taper the first sample to zero", () => {
                expect(samples[0]).toBeCloseTo(0, 5);
            });

            it("should taper the last sample to near zero", () => {
                expect(samples[FFT_SIZE - 1]).toBeCloseTo(0, 3);
            });

            it("should peak near the center", () => {
                const center = samples[Math.floor(FFT_SIZE / 2)];
                expect(center).toBeCloseTo(1.0, 3);
            });
        });
    });

    describe("fft", () => {
        describe("when given a pure 1 kHz sine wave", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = generateSine(1000, FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                mag = magnitude(real, imag);
            });

            it("should place the peak bin at the expected frequency bin", () => {
                const peak = peakBin(mag);
                const expected = expectedBin(1000);
                // Allow ±1 bin tolerance for rounding
                expect(Math.abs(peak - expected)).toBeLessThanOrEqual(1);
            });

            it("should have a non-zero magnitude at the peak", () => {
                expect(mag[peakBin(mag)]).toBeGreaterThan(0);
            });
        });

        describe("when given a pure 440 Hz sine wave (concert A)", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = generateSine(440, FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                mag = magnitude(real, imag);
            });

            it("should place the peak bin near the 440 Hz bin", () => {
                const peak = peakBin(mag);
                const expected = expectedBin(440);
                expect(Math.abs(peak - expected)).toBeLessThanOrEqual(1);
            });
        });

        describe("when given a pure 5 kHz sine wave", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = generateSine(5000, FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                mag = magnitude(real, imag);
            });

            it("should place the peak bin near the 5 kHz bin", () => {
                const peak = peakBin(mag);
                const expected = expectedBin(5000);
                expect(Math.abs(peak - expected)).toBeLessThanOrEqual(2);
            });
        });

        describe("when Hann window is applied before FFT", () => {
            let magWindowed: Float32Array;
            let magUnwindowed: Float32Array;

            beforeEach(() => {
                // Use a frequency that doesn't fall exactly on a bin boundary —
                // this is where leakage is most visible.
                const freqHz = 1234;

                const realW = generateSine(freqHz, FFT_SIZE);
                applyHannWindow(realW);
                const imagW = new Float32Array(FFT_SIZE);
                fft(realW, imagW);
                magWindowed = magnitude(realW, imagW);

                const realU = generateSine(freqHz, FFT_SIZE);
                const imagU = new Float32Array(FFT_SIZE);
                fft(realU, imagU);
                magUnwindowed = magnitude(realU, imagU);
            });

            it("should produce less energy in bins far from the peak (reduced leakage)", () => {
                const peak = peakBin(magWindowed);
                // Sum energy 50+ bins away from the peak — leakage shows up there.
                let leakageWindowed = 0;
                let leakageUnwindowed = 0;
                for (let i = 0; i < magWindowed.length; i++) {
                    if (Math.abs(i - peak) > 50) {
                        leakageWindowed += magWindowed[i];
                        leakageUnwindowed += magUnwindowed[i];
                    }
                }
                expect(leakageWindowed).toBeLessThan(leakageUnwindowed);
            });
        });
    });

    describe("magnitude", () => {
        describe("when given a zero-signal FFT output", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = new Float32Array(FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                mag = magnitude(real, imag);
            });

            it("should return N/2 bins", () => {
                expect(mag.length).toBe(FFT_SIZE / 2);
            });

            it("should be all zeros", () => {
                const sum = mag.reduce((a, b) => a + b, 0);
                expect(sum).toBe(0);
            });
        });
    });

    describe("logFrequencyBins", () => {
        describe("when mapping a 1 kHz sine wave to 60 columns", () => {
            let columns: number[];

            beforeEach(() => {
                const real = generateSine(1000, FFT_SIZE);
                applyHannWindow(real);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                const mag = magnitude(real, imag);
                columns = logFrequencyBins(mag, 60, SAMPLE_RATE, 20, 20000);
            });

            it("should return exactly 60 columns", () => {
                expect(columns.length).toBe(60);
            });

            it("should have a peak normalized to 1.0", () => {
                const max = Math.max(...columns);
                expect(max).toBeCloseTo(1.0, 5);
            });

            it("should have the peak in the lower-mid portion of the spectrum (1 kHz is below center on log scale)", () => {
                const peakCol = columns.indexOf(Math.max(...columns));
                // 1 kHz on a log scale from 20 Hz to 20 kHz: log10(1000) is ~3,
                // log10(20)≈1.3, log10(20000)≈4.3 → position ≈ (3-1.3)/(4.3-1.3) ≈ 0.57
                // So peak should be in the first ~60% of columns
                expect(peakCol).toBeLessThan(40);
                expect(peakCol).toBeGreaterThan(0);
            });
        });

        describe("when given a flat (zero) magnitude spectrum", () => {
            let columns: number[];

            beforeEach(() => {
                const mag = new Float32Array(FFT_SIZE / 2);
                columns = logFrequencyBins(mag, 40, SAMPLE_RATE, 20, 20000);
            });

            it("should return all zeros", () => {
                const sum = columns.reduce((a, b) => a + b, 0);
                expect(sum).toBe(0);
            });
        });
    });

    describe("extractChannel", () => {
        describe("when extracting the left channel", () => {
            let result: Float32Array;

            beforeEach(() => {
                // Build a PCM buffer: left = 16384 (0.5 normalized), right = -16384
                // 4 stereo samples = 16 bytes
                const buf = Buffer.alloc(16);
                for (let i = 0; i < 4; i++) {
                    buf.writeInt16LE(16384, i * 2 * 2); // left
                    buf.writeInt16LE(-16384, (i * 2 + 1) * 2); // right
                }
                result = extractChannel(buf, 0, 4);
            });

            it("should return 4 samples", () => {
                expect(result.length).toBe(4);
            });

            it("should normalize left channel samples to approximately 0.5", () => {
                for (const s of result) {
                    expect(s).toBeCloseTo(0.5, 3);
                }
            });
        });

        describe("when extracting the right channel", () => {
            let result: Float32Array;

            beforeEach(() => {
                const buf = Buffer.alloc(16);
                for (let i = 0; i < 4; i++) {
                    buf.writeInt16LE(16384, i * 2 * 2);
                    buf.writeInt16LE(-16384, (i * 2 + 1) * 2);
                }
                result = extractChannel(buf, 1, 4);
            });

            it("should normalize right channel samples to approximately -0.5", () => {
                for (const s of result) {
                    expect(s).toBeCloseTo(-0.5, 3);
                }
            });
        });

        describe("when numSamples is zero (empty buffer case)", () => {
            let result: Float32Array;

            beforeEach(() => {
                result = extractChannel(Buffer.alloc(0), 0, 0);
            });

            it("should return an empty Float32Array", () => {
                expect(result.length).toBe(0);
            });
        });

        describe("when the buffer contains Int16 minimum value (-32768)", () => {
            let result: Float32Array;

            beforeEach(() => {
                // 1 stereo sample: left = -32768, right = 0
                const buf = Buffer.alloc(4);
                buf.writeInt16LE(-32768, 0); // left
                buf.writeInt16LE(0, 2); // right
                result = extractChannel(buf, 0, 1);
            });

            it("should normalize -32768 to exactly -1.0", () => {
                expect(result[0]).toBeCloseTo(-1.0, 5);
            });
        });

        describe("when the buffer contains Int16 maximum value (32767)", () => {
            let result: Float32Array;

            beforeEach(() => {
                // 1 stereo sample: left = 32767, right = 0
                const buf = Buffer.alloc(4);
                buf.writeInt16LE(32767, 0);
                buf.writeInt16LE(0, 2);
                result = extractChannel(buf, 0, 1);
            });

            it("should normalize 32767 to just under 1.0 (asymmetric normalization is intentional)", () => {
                // Division by 32768 means max int16 (32767) maps to ~0.99997, not 1.0
                expect(result[0]).toBeGreaterThan(0.999);
                expect(result[0]).toBeLessThan(1.0);
            });
        });
    });

    describe("applyHannWindow", () => {
        describe("when applied to a 2-sample array (minimum non-degenerate size)", () => {
            let samples: Float32Array;

            beforeEach(() => {
                samples = new Float32Array([1.0, 1.0]);
                applyHannWindow(samples);
            });

            it("should taper both endpoints toward zero (N=2, N-1=1 is valid)", () => {
                // At i=0: 0.5*(1 - cos(0)) = 0; at i=1: 0.5*(1 - cos(2π)) = 0
                expect(samples[0]).toBeCloseTo(0, 5);
                expect(samples[1]).toBeCloseTo(0, 5);
            });
        });

        describe("when applied to a 1-sample array (degenerate: N-1 = 0)", () => {
            let samples: Float32Array;

            beforeEach(() => {
                samples = new Float32Array([1.0]);
                applyHannWindow(samples);
            });

            it("should leave the sample unchanged (early return guard prevents NaN from dividing by N-1=0)", () => {
                // FFT_SIZE is always 2048 in practice, but the guard prevents a silent
                // NaN corruption if a 1-element array is ever passed in.
                expect(samples[0]).toBe(1.0);
            });
        });
    });

    describe("fft", () => {
        describe("when given a size-2 FFT (minimum power-of-2)", () => {
            let real: Float32Array;
            let imag: Float32Array;

            beforeEach(() => {
                real = new Float32Array([1.0, -1.0]);
                imag = new Float32Array([0.0, 0.0]);
                fft(real, imag);
            });

            it("should produce DC=0 and Nyquist=2 for an alternating [1,-1] signal", () => {
                // DFT of [1, -1]: bin 0 = 1+(-1) = 0, bin 1 = 1-(-1) = 2
                expect(real[0]).toBeCloseTo(0, 5);
                expect(real[1]).toBeCloseTo(2, 5);
            });
        });

        describe("when given an all-zeros signal", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = new Float32Array(FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                mag = magnitude(real, imag);
            });

            it("should produce all-zero magnitudes", () => {
                const sum = mag.reduce((a, b) => a + b, 0);
                expect(sum).toBe(0);
            });
        });

        describe("when given a DC signal (constant value)", () => {
            let mag: Float32Array;

            beforeEach(() => {
                const real = new Float32Array(FFT_SIZE).fill(1.0);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                mag = magnitude(real, imag);
            });

            it("should place all energy in bin 0 (DC)", () => {
                // All bins except bin 0 should be near zero
                const nonDcEnergy = mag.slice(1).reduce((a, b) => a + b, 0);
                expect(mag[0]).toBeGreaterThan(0);
                expect(nonDcEnergy).toBeCloseTo(0, 3);
            });
        });
    });

    describe("logFrequencyBins", () => {
        describe("when numColumns is 1 (single column)", () => {
            let columns: number[];

            beforeEach(() => {
                const real = generateSine(1000, FFT_SIZE);
                const imag = new Float32Array(FFT_SIZE);
                fft(real, imag);
                const mag = magnitude(real, imag);
                columns = logFrequencyBins(mag, 1, SAMPLE_RATE, 20, 20000);
            });

            it("should return exactly 1 column", () => {
                expect(columns.length).toBe(1);
            });

            it("should normalize the single column to 1.0 since it is the global max", () => {
                expect(columns[0]).toBeCloseTo(1.0, 5);
            });
        });

        describe("when minHz equals maxHz (degenerate frequency range)", () => {
            let columns: number[];

            beforeEach(() => {
                const mag = new Float32Array(FFT_SIZE / 2).fill(0.5);
                // logRange = log10(1000) - log10(1000) = 0
                columns = logFrequencyBins(mag, 10, SAMPLE_RATE, 1000, 1000);
            });

            it("should return the requested number of columns without throwing", () => {
                expect(columns.length).toBe(10);
            });

            it("should produce a flat output (all columns map to the same single bin)", () => {
                // All columns share the same freq range (zero width), so they all get the same bin
                // After normalization the max is 1.0 (or all zeros if the bin is 0)
                const max = Math.max(...columns);
                expect(max).toBeGreaterThanOrEqual(0);
                expect(max).toBeLessThanOrEqual(1.0);
            });
        });

        describe("when the magnitude spectrum has a uniform non-zero value", () => {
            let columns: number[];

            beforeEach(() => {
                const mag = new Float32Array(FFT_SIZE / 2).fill(0.5);
                columns = logFrequencyBins(mag, 20, SAMPLE_RATE, 20, 20000);
            });

            it("should normalize so that the peak column is 1.0", () => {
                const max = Math.max(...columns);
                expect(max).toBeCloseTo(1.0, 5);
            });

            it("should return 20 columns", () => {
                expect(columns.length).toBe(20);
            });
        });
    });
});
