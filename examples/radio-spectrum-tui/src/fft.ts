// Minimal radix-2 Cooley-Tukey FFT.
//
// This is purpose-built for the spectrum analyzer — 2048-point FFT on
// signed 16-bit PCM data. No npm dependency needed for ~60 lines of math.
//
// All functions are pure and allocation-friendly: applyHannWindow mutates
// in-place, computeFft returns a new Float32Array pair for real/imag.

/** FFT size used throughout the example. Power of 2 required for radix-2. */
export const FFT_SIZE = 2048;

/** Sample rate — must match ffmpeg decode settings in stream-reader. */
export const SAMPLE_RATE = 44100;

/**
 * Apply a Hann window to a real-valued sample array in-place.
 *
 * Windowing tapers the signal to zero at both ends, which reduces spectral
 * leakage (the smearing of energy from one frequency bin into neighbors).
 * Without it, sharp transitions at the chunk boundaries look like broadband noise.
 */
export const applyHannWindow = (samples: Float32Array): void => {
    const N = samples.length;
    // A 1-element array has N-1=0, which would produce NaN from division by zero.
    // There's nothing meaningful to window in a 1-sample signal anyway.
    if (N <= 1) {
        return;
    }
    for (let i = 0; i < N; i++) {
        // Standard Hann window formula
        samples[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    }
};

/**
 * Radix-2 Cooley-Tukey FFT (in-place, iterative).
 *
 * Takes real and imaginary input arrays of length N (power of 2).
 * Modifies both arrays in-place — real and imaginary parts of complex output.
 *
 * The iterative (non-recursive) form avoids stack-depth issues at N=2048
 * and is cache-friendlier than recursive decomposition.
 */
export const fft = (real: Float32Array, imag: Float32Array): void => {
    const N = real.length;

    // Bit-reversal permutation — reorders samples so the butterfly stages work correctly.
    const bits = Math.log2(N);
    for (let i = 0; i < N; i++) {
        let j = 0;
        for (let k = 0; k < bits; k++) {
            j = (j << 1) | ((i >> k) & 1);
        }
        if (j > i) {
            // Swap real
            const tr = real[i];
            real[i] = real[j];
            real[j] = tr;
            // Swap imag
            const ti = imag[i];
            imag[i] = imag[j];
            imag[j] = ti;
        }
    }

    // Butterfly stages — Cooley-Tukey iterative form.
    for (let len = 2; len <= N; len <<= 1) {
        const halfLen = len >> 1;
        const wRe = Math.cos((2 * Math.PI) / len);
        const wIm = -Math.sin((2 * Math.PI) / len);

        for (let i = 0; i < N; i += len) {
            let curRe = 1;
            let curIm = 0;

            for (let j = 0; j < halfLen; j++) {
                const uRe = real[i + j];
                const uIm = imag[i + j];
                const tRe = curRe * real[i + j + halfLen] - curIm * imag[i + j + halfLen];
                const tIm = curRe * imag[i + j + halfLen] + curIm * real[i + j + halfLen];

                real[i + j] = uRe + tRe;
                imag[i + j] = uIm + tIm;
                real[i + j + halfLen] = uRe - tRe;
                imag[i + j + halfLen] = uIm - tIm;

                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
};

/**
 * Compute magnitude spectrum from FFT output.
 *
 * Returns only the first N/2 bins — the second half of a real-input FFT is
 * the complex conjugate mirror of the first half and carries no new info.
 * Magnitudes are normalized by N/2 so they're independent of FFT size.
 */
export const magnitude = (real: Float32Array, imag: Float32Array): Float32Array => {
    const N = real.length;
    const half = N >> 1;
    const mag = new Float32Array(half);
    const norm = half;
    for (let i = 0; i < half; i++) {
        mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / norm;
    }
    return mag;
};

/**
 * Map FFT magnitude bins to logarithmic frequency columns.
 *
 * Linear FFT bins are spaced evenly in Hz — most of the useful audio
 * information lives in the low-frequency bins (bass, mids), so a linear
 * mapping wastes most of the display width on the inaudible high end.
 *
 * Log mapping spreads the display across perceived octaves, which is how
 * human hearing actually works and how pro audio spectrum analyzers look.
 *
 * @param mag - Magnitude spectrum, length N/2
 * @param numColumns - Number of display columns to produce
 * @param sampleRate - Sample rate (Hz) — needed to compute bin frequencies
 * @param minHz - Lowest frequency to show (20 Hz is typical)
 * @param maxHz - Highest frequency to show (20 kHz is typical)
 * @returns Normalized column heights, each 0–1
 */
export const logFrequencyBins = (
    mag: Float32Array,
    numColumns: number,
    sampleRate: number,
    minHz: number,
    maxHz: number
): number[] => {
    const N = mag.length * 2; // Full FFT size
    const binHz = sampleRate / N; // Hz per FFT bin
    const logMin = Math.log10(minHz);
    const logMax = Math.log10(maxHz);
    const logRange = logMax - logMin;

    const columns = new Array<number>(numColumns).fill(0);

    // For each output column, find the FFT bin range that maps to it and take the max.
    // Max (rather than mean) gives a more responsive, "energetic" display.
    for (let col = 0; col < numColumns; col++) {
        const freqLo = Math.pow(10, logMin + (col / numColumns) * logRange);
        const freqHi = Math.pow(10, logMin + ((col + 1) / numColumns) * logRange);

        const binLo = Math.max(0, Math.floor(freqLo / binHz));
        const binHi = Math.min(mag.length - 1, Math.ceil(freqHi / binHz));

        let peak = 0;
        for (let b = binLo; b <= binHi; b++) {
            if (mag[b] > peak) {
                peak = mag[b];
            }
        }
        columns[col] = peak;
    }

    // Normalize so the loudest column is 1.0.
    // This makes the display responsive to quiet passages without looking dead.
    let globalMax = 0;
    for (const v of columns) {
        if (v > globalMax) {
            globalMax = v;
        }
    }
    if (globalMax > 0) {
        for (let i = 0; i < columns.length; i++) {
            columns[i] /= globalMax;
        }
    }

    return columns;
};

/**
 * Convert a raw Int16 PCM buffer (signed 16-bit LE, interleaved stereo)
 * into a normalized Float32Array for one channel.
 *
 * Takes every other sample starting at `channelOffset` (0 = left, 1 = right).
 * Normalizes to -1.0 – 1.0 range.
 */
export const extractChannel = (
    pcmBuffer: Buffer,
    channelOffset: 0 | 1,
    numSamples: number
): Float32Array => {
    const out = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        // Each sample is 2 bytes (Int16), stereo interleaved: L R L R ...
        const byteOffset = (i * 2 + channelOffset) * 2;
        // readInt16LE handles sign extension correctly for negative values.
        out[i] = pcmBuffer.readInt16LE(byteOffset) / 32768;
    }
    return out;
};
