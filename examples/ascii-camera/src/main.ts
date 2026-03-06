// Main entry point for the ASCII camera demo.
//
// Responsibilities:
//   1. Enter alternate screen buffer
//   2. Spawn the camera worker thread, connect postal transport
//   3. Subscribe to camera.frame to render ASCII art
//   4. Subscribe to camera.status to show startup/error messages
//   5. Add a wiretap to measure observable frame rate (HUD stats)
//   6. Handle keyboard input: c (color), +/- (fps), q (quit)
//   7. Restore terminal on exit

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getChannel, addTransport, addWiretap, type Channel, type ChannelRegistry } from "postal";
import { connectToWorkerThread } from "postal-transport-messageport/node";
import {
    enterAltScreen,
    exitAltScreen,
    hideCursor,
    showCursor,
    cursorHome,
    clearToEnd,
    dim,
    bold,
    fg,
} from "./ansi.js";
// Importing from types.js also activates the ChannelRegistry augmentation,
// so getChannel("camera") returns a fully typed channel automatically.
import type { FramePayload } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "camera-worker.ts");

// --- HUD constants ---

const FPS_CLAMP_MIN = 5;
const FPS_CLAMP_MAX = 30;
const FPS_STEP = 5;
const DEFAULT_FPS = 15;
const HUD_SEPARATOR = "─".repeat(70);

// --- App state ---

type AppState = {
    colorMode: boolean;
    targetFps: number;
    statusMessage: string;
    /** Frames seen by the wiretap in the last second — used for HUD fps display. */
    wiretapFrameCount: number;
    wiretapFpsWindowStart: number;
    displayFps: number;
};

const state: AppState = {
    colorMode: false,
    targetFps: DEFAULT_FPS,
    statusMessage: "Starting...",
    wiretapFrameCount: 0,
    wiretapFpsWindowStart: Date.now(),
    displayFps: 0,
};

// --- HUD builder ---

/** Build the status bar shown below the ASCII frame — fps, color mode, key hints. */
const buildHud = (): string => {
    const colorLabel = state.colorMode ? bold(fg(100, 220, 255, "COLOR")) : dim("MONO");
    const fpsLabel = bold(String(state.displayFps)) + " fps";
    const help = dim("c: toggle color  ·  +/-: fps  ·  q: quit");
    return (
        "\n" +
        dim(HUD_SEPARATOR) +
        "\n " +
        fpsLabel +
        "  ·  " +
        colorLabel +
        "  ·  " +
        help +
        "\n" +
        dim(HUD_SEPARATOR)
    );
};

// --- Render ---

/** Write frame + HUD in a single stdout call to avoid partial-frame flicker. */
const renderFrame = (payload: FramePayload): void => {
    const out = cursorHome() + payload.frame + buildHud();
    process.stdout.write(out);
};

/** Show a one-line status message (used during startup and on errors). */
const renderStatus = (msg: string): void => {
    process.stdout.write(cursorHome() + msg + "\n");
};

// --- Cleanup ---

let worker: Worker | null = null;
let channel: Channel<ChannelRegistry["camera"]>;
let cleanedUp = false;

const cleanup = (): void => {
    // Guard against double-cleanup from both SIGINT and 'q' keypress.
    if (cleanedUp) {
        return;
    }
    cleanedUp = true;

    channel.publish("camera.control", { action: "quit" });

    // Grace period: let the worker kill ffmpeg cleanly before we hard-terminate.
    setTimeout(() => {
        if (worker !== null) {
            worker.terminate();
        }

        process.stdout.write(showCursor() + exitAltScreen());

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

        process.exit(0);
    }, 200);
};

// --- Main ---

const main = async (): Promise<void> => {
    // Enter alternate screen before anything else so startup messages
    // land inside the alt buffer and are cleaned up on exit.
    process.stdout.write(enterAltScreen() + hideCursor());

    // Forward execArgv so the worker inherits --import flags (e.g. tsx's ESM
    // loader). Without this, the worker can't resolve .ts imports at runtime.
    const w = new Worker(WORKER_PATH, { execArgv: process.execArgv });
    worker = w;

    w.on("error", err => {
        renderStatus(`Worker error: ${err.message}`);
    });

    let transport;
    try {
        transport = await connectToWorkerThread(w);
    } catch (err) {
        process.stdout.write(showCursor() + exitAltScreen());
        process.stderr.write(`Transport handshake failed: ${String(err)}\n`);
        w.terminate();
        process.exit(1);
    }

    addTransport(transport);
    channel = getChannel("camera");

    // Hot path — every frame the worker publishes lands here.
    channel.subscribe("camera.frame", envelope => {
        if (envelope.payload) {
            renderFrame(envelope.payload);
        }
    });

    channel.subscribe("camera.status", envelope => {
        const payload = envelope.payload;
        if (!payload) {
            return;
        }
        state.statusMessage = payload.message ?? payload.status;
        if (payload.status === "error") {
            renderStatus(`Camera error: ${state.statusMessage}`);
        }
    });

    // Wiretap: count camera.frame messages to compute an independent FPS measurement.
    // This demonstrates the wiretap as an observability hook — it sees everything
    // on the bus without modifying the subscription graph.
    addWiretap(envelope => {
        if (envelope.topic !== "camera.frame") {
            return;
        }
        state.wiretapFrameCount++;
        const now = Date.now();
        if (now - state.wiretapFpsWindowStart >= 1000) {
            state.displayFps = state.wiretapFrameCount;
            state.wiretapFrameCount = 0;
            state.wiretapFpsWindowStart = now;
        }
    });

    // --- Keyboard input ---

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        process.stdin.on("data", (key: string) => {
            if (key === "q" || key === "\u0003") {
                cleanup();
                return;
            }

            if (key === "c") {
                state.colorMode = !state.colorMode;
                // Clear screen on toggle so no residual characters from the
                // previous mode bleed through before the next frame arrives.
                process.stdout.write(cursorHome() + clearToEnd());
                channel.publish("camera.control", {
                    action: "set-color-mode",
                    value: state.colorMode,
                });
                return;
            }

            if (key === "+" || key === "=") {
                state.targetFps = Math.min(FPS_CLAMP_MAX, state.targetFps + FPS_STEP);
                channel.publish("camera.control", { action: "set-fps", value: state.targetFps });
                return;
            }

            if (key === "-") {
                state.targetFps = Math.max(FPS_CLAMP_MIN, state.targetFps - FPS_STEP);
                channel.publish("camera.control", { action: "set-fps", value: state.targetFps });
                return;
            }
        });
    }

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    renderStatus("Waiting for camera...");
};

main().catch(err => {
    process.stderr.write(`Fatal: ${String(err)}\n`);
    process.exit(1);
});
