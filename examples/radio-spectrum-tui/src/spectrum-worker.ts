// Spectrum analyzer child process — Child 2.
//
// Responsibilities:
//   1. Connect to parent postal bus
//   2. Subscribe to radio.audio.pcm
//   3. Decode base64 PCM, apply Hann window, run FFT
//   4. Map FFT magnitudes to log-frequency columns
//   5. Apply exponential smoothing so bars decay gracefully (no flicker)
//   6. Publish radio.viz.spectrum
//   7. Clean shutdown on radio.control.quit

import { getChannel, addTransport } from "postal";
import { connectToParent } from "postal-transport-childprocess";
import {
    FFT_SIZE,
    applyHannWindow,
    fft,
    magnitude,
    logFrequencyBins,
    extractChannel,
} from "./fft.js";
import type { PcmPayload } from "./types.js";

// Number of output columns published per frame. The parent's SpectrumPane
// re-maps these to the actual terminal width via linear interpolation, so
// this is effectively the resolution of the analysis, not the display.
const DEFAULT_COLUMNS = 64;

// Exponential smoothing factor for bar heights.
// Higher = faster decay (more responsive but jittery).
// Lower = slower decay (smoother but laggy).
// 0.2 gives a visual decay of roughly 5 frames to reach baseline.
const SMOOTHING = 0.2;

let smoothedBins: number[] = new Array<number>(DEFAULT_COLUMNS).fill(0);

/**
 * Blend new FFT bin values with the previous frame's values.
 *
 * Attack is instant (bar snaps up) because the eye expects fast onset.
 * Decay is gradual (exponential blend toward zero) to prevent the jittery
 * flickering you'd get from raw FFT magnitudes frame-to-frame.
 */
const applySmoothing = (newBins: number[]): number[] => {
    if (smoothedBins.length !== newBins.length) {
        // Terminal was resized — reset smoothing buffer.
        smoothedBins = new Array<number>(newBins.length).fill(0);
    }
    for (let i = 0; i < newBins.length; i++) {
        // Attack fast, decay slow — classic spectrum analyzer behavior.
        // New value dominates on the way up; old value decays slowly on the way down.
        if (newBins[i] > smoothedBins[i]) {
            smoothedBins[i] = newBins[i];
        } else {
            smoothedBins[i] = smoothedBins[i] * (1 - SMOOTHING) + newBins[i] * SMOOTHING;
        }
    }
    return [...smoothedBins];
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
        // Use left channel for spectrum — stereo average would be marginally
        // better but adds complexity for no visible difference.
        const numSamples = Math.min(FFT_SIZE, pcmBuffer.length / (2 * 2));
        const real = extractChannel(pcmBuffer, 0, numSamples);

        // Pad to FFT_SIZE if the chunk was smaller (last chunk of a stream).
        const realPadded = new Float32Array(FFT_SIZE);
        realPadded.set(real);

        applyHannWindow(realPadded);
        const imag = new Float32Array(FFT_SIZE);
        fft(realPadded, imag);
        const mag = magnitude(realPadded, imag);

        const rawBins = logFrequencyBins(mag, DEFAULT_COLUMNS, payload.rate, 20, 20000);
        const bins = applySmoothing(rawBins);

        channel.publish("radio.viz.spectrum", { bins });
    });

    channel.subscribe("radio.control.#", envelope => {
        if (envelope.topic === "radio.control.quit") {
            process.exit(0);
        }
    });
};

main().catch(err => {
    process.stderr.write(`[spectrum-worker] Fatal: ${String(err)}\n`);
    process.exit(1);
});
