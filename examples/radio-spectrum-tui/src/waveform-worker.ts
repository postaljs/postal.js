// Waveform and VU meter child process — Child 3.
//
// Responsibilities:
//   1. Connect to parent postal bus
//   2. Subscribe to radio.audio.pcm
//   3. Downsample PCM to waveform display columns, publish radio.viz.waveform
//   4. Compute per-channel RMS and peak levels with peak-hold decay,
//      publish radio.viz.levels
//   5. Clean shutdown on radio.control.quit

import { getChannel, addTransport } from "postal";
import { connectToParent } from "postal-transport-childprocess";
import { extractChannel } from "./fft.js";
import type { PcmPayload, LevelData } from "./types.js";

// Columns per PCM chunk — controls scroll speed in the display.
// At ~21 chunks/sec and ~78 display columns, 2 cols/chunk ≈ 1.8s full scroll.
const WAVEFORM_COLUMNS = 2;

// Peak-hold decay: each frame the peak drops by this fraction.
// At ~20 chunks/sec, 0.05 per chunk gives a ~1-second decay.
const PEAK_DECAY = 0.05;

// Per-channel peak state persists between PCM chunks.
let peakLeft = 0;
let peakRight = 0;

/**
 * Downsample a Float32Array to `numColumns` peak-amplitude values.
 *
 * Uses peak absolute value per window — not signed average — so the
 * result is always 0–1 and represents the signal envelope. Signed
 * averages cancel out for music and produce near-zero, which is why
 * the old oscilloscope approach looked empty.
 */
export const downsampleWaveform = (samples: Float32Array, numColumns: number): number[] => {
    const result: number[] = [];
    const windowSize = Math.max(1, Math.floor(samples.length / numColumns));

    for (let col = 0; col < numColumns; col++) {
        const start = col * windowSize;
        const end = Math.min(start + windowSize, samples.length);
        if (end <= start) {
            result.push(0);
            continue;
        }
        let peak = 0;
        for (let i = start; i < end; i++) {
            const abs = Math.abs(samples[i]);
            if (abs > peak) {
                peak = abs;
            }
        }
        result.push(peak);
    }

    return result;
};

/**
 * Compute RMS level from a normalized sample array.
 * Returns a value in [0, 1].
 */
export const computeRms = (samples: Float32Array): number => {
    if (samples.length === 0) {
        return 0;
    }
    let sumSq = 0;
    for (const s of samples) {
        sumSq += s * s;
    }
    return Math.sqrt(sumSq / samples.length);
};

/**
 * Compute peak (max absolute value) from a normalized sample array.
 * Returns a value in [0, 1].
 */
export const computePeak = (samples: Float32Array): number => {
    let max = 0;
    for (const s of samples) {
        const abs = Math.abs(s);
        if (abs > max) {
            max = abs;
        }
    }
    return max;
};

/**
 * Compute stereo RMS + peak-hold levels for the VU meters.
 *
 * Peak-hold mimics hardware VU meters: the peak marker jumps to new highs
 * instantly but decays slowly (linear ramp down), giving the viewer a
 * sense of the recent loudest transient. The decay rate is tuned so the
 * marker holds for roughly one second before falling back to baseline.
 */
const processLevels = (
    leftSamples: Float32Array,
    rightSamples: Float32Array
): { left: LevelData; right: LevelData } => {
    const rmsL = computeRms(leftSamples);
    const rmsR = computeRms(rightSamples);
    const peakInstL = computePeak(leftSamples);
    const peakInstR = computePeak(rightSamples);

    // Peak hold: replace if new peak is higher, otherwise decay.
    if (peakInstL >= peakLeft) {
        peakLeft = peakInstL;
    } else {
        peakLeft = Math.max(0, peakLeft - PEAK_DECAY);
    }

    if (peakInstR >= peakRight) {
        peakRight = peakInstR;
    } else {
        peakRight = Math.max(0, peakRight - PEAK_DECAY);
    }

    return {
        left: { rms: rmsL, peak: peakLeft },
        right: { rms: rmsR, peak: peakRight },
    };
};

const main = async (): Promise<void> => {
    const transport = await connectToParent();
    addTransport(transport);

    const channel = getChannel("radio");

    channel.subscribe("radio.audio.pcm", envelope => {
        const payload = envelope.payload as PcmPayload;
        if (!payload?.samples) {
            return;
        }

        const pcmBuffer = Buffer.from(payload.samples, "base64");
        // 4 bytes per stereo sample pair (2 bytes × 2 channels)
        const numSamples = Math.floor(pcmBuffer.length / (2 * 2));

        const leftSamples = extractChannel(pcmBuffer, 0, numSamples);
        const rightSamples = extractChannel(pcmBuffer, 1, numSamples);

        // Waveform — use left channel (mono-compatible).
        const waveformSamples = downsampleWaveform(leftSamples, WAVEFORM_COLUMNS);
        channel.publish("radio.viz.waveform", { samples: waveformSamples });

        // VU levels — stereo.
        const levels = processLevels(leftSamples, rightSamples);
        channel.publish("radio.viz.levels", levels);
    });

    channel.subscribe("radio.control.#", envelope => {
        if (envelope.topic === "radio.control.quit") {
            process.exit(0);
        }
    });
};

main().catch(err => {
    process.stderr.write(`[waveform-worker] Fatal: ${String(err)}\n`);
    process.exit(1);
});
