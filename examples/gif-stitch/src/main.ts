/**
 * Gif Stitch — main thread entry point.
 *
 * This file is the postal integration hub. It:
 *   1. Spawns the encoder worker and connects postal across the boundary
 *   2. Sets up the orchestration loop (capture → request → display)
 *   3. Wires UI events (ui.start, ui.clear, ui.settings) to app state
 *
 * Everything postal-related that spans the host↔worker boundary happens here.
 * Pure DOM manipulation lives in ui.ts. Camera access lives in camera.ts.
 */

import "./styles.css";

import { getChannel, addTransport, PostalRpcError } from "postal";
import { connectToWorker, markTransferable } from "postal-transport-messageport";
import JSZip from "jszip";
import { initCamera, captureFrames } from "./camera";
import {
    initUI,
    renderGrid,
    setSlotCapturing,
    updateCaptureProgress,
    setSlotEncoding,
    displayGif,
    showError,
    setRecordingState,
    setStatus,
    showCameraActive,
    showCameraLoading,
    showCameraDenied,
    showFatalError,
    getCompletedSlots,
    type AppSettings,
} from "./ui";
import type { Envelope } from "postal";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Shape of the encoding request payload. */
type EncodeRequest = {
    index: number;
    buffers: ArrayBuffer[];
    width: number;
    height: number;
    delay: number;
};

/** Shape of the encoding response from the worker. */
type EncodeResponse = {
    gif: Uint8Array;
};

// ─── App state ─────────────────────────────────────────────────────────────────

// Simple object literal — no state library, no observables.
// For a demo app of this scope, this is exactly the right amount of complexity.
const state = {
    isCapturing: false,
    settings: {} as AppSettings,
    cameraStream: null as MediaStream | null,
    captureCanvas: null as HTMLCanvasElement | null,
};

// ─── Postal setup ──────────────────────────────────────────────────────────────

// The worker uses Vite's module worker syntax so the workspaceSource alias
// applies inside the worker context too. Without `{ type: 'module' }` the
// worker would be treated as a classic script and ESM imports would fail.
const worker = new Worker(new URL("./encoder.worker.ts", import.meta.url), {
    type: "module",
});

// Both sides must resolve before any messages can flow. connectToWorker sends
// the SYN and waits for the ACK from connectToHost() in the worker.
let workerConnected = false;
connectToWorker(worker)
    .then(transport => {
        addTransport(transport);
        workerConnected = true;
    })
    .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        showFatalError(`Worker handshake failed: ${msg}. Try reloading.`);
    });

const channel = getChannel("gif-stitch");

// ─── Capture canvas ────────────────────────────────────────────────────────────

const getCaptureCanvas = (): HTMLCanvasElement => {
    if (!state.captureCanvas) {
        state.captureCanvas = document.createElement("canvas");
        // Off-screen canvas — never attached to the DOM. We only need its
        // 2D context to call drawImage and getImageData.
        state.captureCanvas.width = 320;
        state.captureCanvas.height = 240;
    }
    return state.captureCanvas;
};

// ─── Orchestration loop ────────────────────────────────────────────────────────

/**
 * Captures frames for one GIF slot, sends the encoding request to the worker,
 * and updates the slot UI with the result.
 *
 * Runs sequentially — we wait for each slot to complete before moving to
 * the next so the grid fills in order. Encoding errors update the slot but
 * don't abort the rest of the batch.
 */
const processSlot = async (index: number): Promise<void> => {
    const { framesPerGif, captureIntervalMs, playbackDelayMs } = state.settings;
    const video = document.getElementById("camera-video") as HTMLVideoElement;
    const canvas = getCaptureCanvas();

    // ── Phase 1: capture frames ──
    setSlotCapturing(index);

    let frames: ImageData[];
    try {
        frames = await captureFrames(
            video,
            canvas,
            framesPerGif,
            captureIntervalMs,
            (captured, total) => {
                updateCaptureProgress(index, captured, total);
                // Publish locally so any other subscribers can react
                channel.publish("capture.frame", { index, captured, total });
            }
        );
    } catch (captureErr) {
        const msg = captureErr instanceof Error ? captureErr.message : "Capture failed";
        showError(index, msg);
        return;
    }

    // ── Phase 2: send frames to worker via postal RPC ──
    setSlotEncoding(index);

    // Extract the raw ArrayBuffers from each ImageData so we can transfer them.
    // After transfer, the buffers in `frames` are neutered — the worker owns them.
    const buffers = frames.map(f => f.data.buffer);

    const payload: EncodeRequest = {
        index,
        buffers,
        width: canvas.width,
        height: canvas.height,
        // gifenc.writeFrame expects delay in milliseconds — it handles the ms->cs conversion internally
        delay: playbackDelayMs,
    };

    // markTransferable tells the MessagePort transport to pass the buffers as
    // a transfer list to postMessage — zero-copy, no structured clone overhead.
    // 10 frames at 320x240 RGBA = ~3MB; at 640x480 it would be ~12MB.
    markTransferable(payload, buffers as unknown as Transferable[]);

    let response: EncodeResponse;
    try {
        if (!workerConnected) {
            throw new Error("Worker not yet connected — try again in a moment");
        }
        response = (await channel.request("encode.start", payload)) as EncodeResponse;
    } catch (rpcErr) {
        if (rpcErr instanceof PostalRpcError) {
            showError(index, `Encoding failed: ${rpcErr.message}`);
        } else {
            const msg = rpcErr instanceof Error ? rpcErr.message : "Unknown error";
            showError(index, msg);
        }
        return;
    }

    // ── Phase 3: display the result ──
    // Create a Blob URL from the GIF bytes so the <img> tag plays it natively.
    // Blob URLs are revoked in clearGrid() to avoid memory leaks.
    const blob = new Blob([response.gif], { type: "image/gif" });
    const blobUrl = URL.createObjectURL(blob);
    displayGif(index, blobUrl);
};

/**
 * The main capture-encode cycle.
 * Processes each slot sequentially, then restores the UI to ready state.
 */
const runCaptureCycle = async (): Promise<void> => {
    if (state.isCapturing) {
        return;
    }
    state.isCapturing = true;

    const { gifCount } = state.settings;
    setRecordingState(true);
    setStatus(`Recording ${gifCount} GIFs…`);

    for (let i = 0; i < gifCount; i++) {
        if (!state.isCapturing) {
            break;
        }
        setStatus(`GIF ${i + 1} of ${gifCount}…`);
        await processSlot(i);
    }

    state.isCapturing = false;
    setRecordingState(false);
    setStatus("Done! Download your GIFs or start again.");
};

// ─── Postal event subscriptions ────────────────────────────────────────────────

// UI publishes "ui.start" when the Start button is clicked.
channel.subscribe("ui.start", (_: Envelope) => {
    if (!state.isCapturing) {
        runCaptureCycle().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            setStatus(`Error: ${msg}`);
            state.isCapturing = false;
            setRecordingState(false);
        });
    }
});

// UI publishes "ui.clear" when the Clear button is clicked.
// clearGrid() is already called in ui.ts's click handler before publishing — don't double-call it here.
channel.subscribe("ui.clear", (_: Envelope) => {
    state.isCapturing = false;
    renderGrid(state.settings.gifCount);
});

// UI publishes "ui.settings" whenever any setting changes.
channel.subscribe("ui.settings", (envelope: Envelope<AppSettings>) => {
    state.settings = { ...envelope.payload };
});

// ─── Download all ──────────────────────────────────────────────────────────────

/**
 * Bundles all completed GIFs into a zip file and triggers a download.
 * Uses JSZip, which is ~45KB gzipped but worth it for the UX — "Download All"
 * as individual files would open 9 browser save dialogs. No thanks.
 */
const downloadAll = async (): Promise<void> => {
    const completed = getCompletedSlots();
    if (completed.length === 0) {
        return;
    }

    const zip = new JSZip();
    const fetchPromises = completed.map(async ({ index, blobUrl }) => {
        const res = await fetch(blobUrl);
        const data = await res.arrayBuffer();
        zip.file(`gif-stitch-${index + 1}.gif`, data);
    });

    await Promise.all(fetchPromises);

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gif-stitch-${ts}.zip`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke immediately — the browser has queued the download by now.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

document.getElementById("download-all-btn")?.addEventListener("click", () => {
    downloadAll().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus(`Zip failed: ${msg}`);
    });
});

// ─── Camera init ───────────────────────────────────────────────────────────────

const initApp = async (): Promise<void> => {
    const settings = initUI();
    state.settings = settings;

    showCameraLoading();

    const video = document.getElementById("camera-video") as HTMLVideoElement;

    const tryInitCamera = async (): Promise<void> => {
        try {
            state.cameraStream = await initCamera(video);
            showCameraActive();
        } catch (err) {
            // NotAllowedError covers both explicit denial and browser default-deny.
            // Any other error (NotFoundError, OverconstrainedError) also lands here.
            showCameraDenied();

            // Log for debugging without crashing the app
            console.warn("Camera init failed:", err);
        }
    };

    // Wire the retry button once as a permanent listener rather than re-registering
    // with { once: true } inside the catch block — avoids fragile listener chaining
    // on repeated failures.
    document.getElementById("camera-retry-btn")?.addEventListener("click", () => {
        showCameraLoading();
        tryInitCamera().catch(() => showCameraDenied());
    });

    await tryInitCamera();
};

initApp().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    showFatalError(`App init failed: ${msg}`);
});
