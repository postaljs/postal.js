// Camera worker — runs inside a Node.js worker thread.
//
// Responsibilities:
//   1. Connect postal transport via connectFromWorkerThread
//   2. Spawn ffmpeg for the platform-appropriate input device
//   3. Buffer incoming stdout bytes into complete RGB24 frames
//   4. Convert each frame to ASCII (mono or color) and publish camera.frame
//   5. Subscribe to camera.control for fps changes, color mode, and quit
//
// Top-level await is fine here — tsx/Node ESM workers support it.

import { spawn, type ChildProcess } from "node:child_process";
import { getChannel, addTransport } from "postal";
import { connectFromWorkerThread } from "postal-transport-messageport/node";
import { buildMonoFrame, buildColorFrame } from "./ascii.ts";
// Importing from types.js also activates the ChannelRegistry augmentation,
// so getChannel("camera") returns a fully typed channel automatically.
import type { StatusPayload, FramePayload } from "./types.js";

// --- Constants ---

const CHANNEL = "camera";
const DEFAULT_FPS = 15;
// ffmpeg capture resolution — narrow width because each ASCII character is
// taller than it is wide, so 160×48 maps to a roughly square-looking image.
const CAPTURE_WIDTH = 160;
const CAPTURE_HEIGHT = 48;
const BYTES_PER_PIXEL = 3; // RGB24
// Exact byte count per raw frame from ffmpeg — this is the buffer boundary
// we use to slice complete frames out of the continuous stdout stream.
const FRAME_BYTES = CAPTURE_WIDTH * CAPTURE_HEIGHT * BYTES_PER_PIXEL;

// --- State ---

type WorkerState = {
    colorMode: boolean;
    fps: number;
    running: boolean;
};

const state: WorkerState = {
    colorMode: false,
    fps: DEFAULT_FPS,
    running: true,
};

// --- Platform-aware ffmpeg args ---

/**
 * Returns the ffmpeg argument list for the current platform.
 * Selects the correct input format and default device.
 *
 * macOS: AVFoundation ("0" = first video device)
 * Linux: v4l2 (/dev/video0)
 * Windows: dshow (does its best)
 */
const buildFfmpegArgs = (fps: number, width: number, height: number): string[] => {
    const platform = process.platform;

    // Capture at the smallest standard resolution the device supports, then
    // downscale to our ASCII grid dimensions via -vf scale. Cameras don't
    // support arbitrary sizes like 160x48 — asking for that directly causes
    // AVFoundation (and most v4l2 devices) to reject the input.
    const captureSize = "640x480";

    // AVFoundation is strict about framerate — it rejects anything that
    // doesn't exactly match a supported mode (e.g. 29.97 fails even though
    // [15, 30] is listed). Always capture at 30fps and use -r on the output
    // side to get the actual desired rate.
    const inputArgs: string[] =
        platform === "darwin"
            ? ["-f", "avfoundation", "-framerate", "30", "-video_size", captureSize, "-i", "0"]
            : platform === "win32"
              ? ["-f", "dshow", "-framerate", "30", "-video_size", captureSize, "-i", "video=0"]
              : ["-f", "v4l2", "-framerate", "30", "-video_size", captureSize, "-i", "/dev/video0"];

    return [
        ...inputArgs,
        "-r",
        String(fps),
        "-vf",
        `scale=${width}:${height}`,
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "pipe:1",
    ];
};

// --- Transport + channel ---

const transport = await connectFromWorkerThread();
addTransport(transport);

const channel = getChannel(CHANNEL);

/** Publish a status update (starting/streaming/error) to the main thread. */
const publishStatus = (payload: StatusPayload): void => {
    channel.publish("camera.status", payload);
};

// --- Control subscription ---
// Main thread publishes camera.control to change fps, color mode, or quit.

channel.subscribe("camera.control", envelope => {
    const control = envelope.payload;

    if (control.action === "quit") {
        state.running = false;
        // Kill ffmpeg immediately rather than waiting for the hard terminate.
        killFfmpeg();
    } else if (control.action === "set-color-mode") {
        state.colorMode = control.value;
    } else if (control.action === "set-fps") {
        // Clamped on the main-thread side already, but clamp again for safety.
        state.fps = Math.max(5, Math.min(30, control.value));
        // Note: changing fps requires restarting ffmpeg. We signal the capture
        // loop to restart by toggling a flag — simplest approach that avoids
        // killing and re-awaiting the process in-line.
        restartFfmpeg();
    }
});

// --- ffmpeg capture loop ---

let ffmpegProc: ChildProcess | null = null;

/** Kill the current ffmpeg process if one is running. */
const killFfmpeg = (): void => {
    if (ffmpegProc !== null) {
        ffmpegProc.kill("SIGTERM");
        ffmpegProc = null;
    }
};

/** Restart ffmpeg — called when fps changes mid-stream. */
const restartFfmpeg = (): void => {
    killFfmpeg();
    startCapture();
};

/**
 * Spawn ffmpeg and process its stdout as a continuous stream of RGB24 frames.
 *
 * Frame dropping strategy: we track whether the previous publish completed
 * before the next frame arrives. If the worker is producing frames faster
 * than postal can ship them, we drop the incoming frame rather than queuing.
 * Latest-wins is the right semantics for live video.
 */
const startCapture = (): void => {
    publishStatus({ status: "starting" });

    const args = buildFfmpegArgs(state.fps, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    // Capture stderr so we can include it in unexpected-exit error messages.
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    ffmpegProc = proc;

    // Accumulate stderr in case ffmpeg exits with an error we need to report.
    let stderrOutput = "";
    proc.stderr.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
    });

    // Chunk list for buffering incomplete frames — avoids copying the entire
    // accumulated buffer on every data event (which at 15fps causes GC churn).
    const chunks: Buffer[] = [];
    let bufferedLength = 0;

    // Latest-wins backpressure — see startCapture JSDoc.
    let publishing = false;

    let frameCount = 0;
    let fpsWindowStart = Date.now();
    let measuredFps = 0;

    // Emit "streaming" exactly once, on the first successfully published frame.
    let hasEmittedStreaming = false;

    proc.stdout.on("data", (chunk: Buffer) => {
        if (!state.running) {
            return;
        }

        chunks.push(chunk);
        bufferedLength += chunk.length;

        // Drain complete frames from the buffer.
        while (bufferedLength >= FRAME_BYTES) {
            // Concat only when we know we have a full frame to extract.
            const combined = Buffer.concat(chunks);
            chunks.length = 0;
            const frameData = combined.subarray(0, FRAME_BYTES);
            const remainder = combined.subarray(FRAME_BYTES);
            if (remainder.length > 0) {
                chunks.push(remainder);
            }
            bufferedLength = remainder.length;

            // Drop this frame if the previous publish hasn't cleared.
            // This is intentional backpressure — we'd rather drop than queue.
            if (publishing) {
                continue;
            }

            publishing = true;

            frameCount++;
            const now = Date.now();
            if (now - fpsWindowStart >= 1000) {
                measuredFps = frameCount;
                frameCount = 0;
                fpsWindowStart = now;
            }

            const pixelBuf = new Uint8Array(
                frameData.buffer,
                frameData.byteOffset,
                frameData.byteLength
            );

            const frameString = state.colorMode
                ? buildColorFrame(pixelBuf, CAPTURE_WIDTH, CAPTURE_HEIGHT)
                : buildMonoFrame(pixelBuf, CAPTURE_WIDTH, CAPTURE_HEIGHT);

            const payload: FramePayload = {
                frame: frameString,
                width: CAPTURE_WIDTH,
                height: CAPTURE_HEIGHT,
                fps: measuredFps,
                colorMode: state.colorMode,
            };

            channel.publish("camera.frame", payload);
            publishing = false;

            // Signal "streaming" once we've successfully published a frame —
            // doing it here avoids the race that existed with a second "data" listener.
            if (!hasEmittedStreaming) {
                hasEmittedStreaming = true;
                publishStatus({ status: "streaming" });
            }
        }
    });

    proc.on("error", (err: Error) => {
        publishStatus({ status: "error", message: err.message });
    });

    proc.on("close", () => {
        // If we're still supposed to be running, ffmpeg exited unexpectedly.
        if (state.running) {
            const detail = stderrOutput.trim() ? `: ${stderrOutput.trim()}` : "";
            publishStatus({ status: "error", message: `ffmpeg exited unexpectedly${detail}` });
        }
        ffmpegProc = null;
    });
};

startCapture();
