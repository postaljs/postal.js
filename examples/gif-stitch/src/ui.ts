/**
 * UI management for Gif Stitch.
 *
 * All direct DOM manipulation lives here. The rest of the app (main.ts) talks
 * to this module via plain function calls and receives back postal event names
 * to subscribe to. No postal imports here — UI publishes events, main.ts wires
 * the subscriptions. This keeps the postal topology visible in one place.
 *
 * Slot states:
 *   empty     → dashed border, slot number
 *   capturing → animated border pulse, "Capturing N/M" overlay
 *   encoding  → progress bar overlay
 *   complete  → img tag with animated GIF, hover download button
 *   error     → red border, error message
 */

import { getChannel } from "postal";
import type { Envelope } from "postal";

// The local postal channel — used for UI events only (no transport attached here).
// main.ts subscribes to these topics to drive the orchestration loop.
const channel = getChannel("gif-stitch");

export type SlotState = "empty" | "capturing" | "encoding" | "complete" | "error";

/** Per-slot runtime data tracked by the UI layer. */
type SlotData = {
    el: HTMLElement;
    state: SlotState;
    blobUrl: string | null;
};

// Module-level slot registry — updated as the grid is rendered and states change.
const slots: SlotData[] = [];

/** Current settings — updated by the settings panel, read by main.ts. */
export type AppSettings = {
    gifCount: number;
    framesPerGif: number;
    captureIntervalMs: number;
    playbackDelayMs: number;
};

const DEFAULT_SETTINGS: AppSettings = {
    gifCount: 9,
    framesPerGif: 10,
    captureIntervalMs: 500,
    playbackDelayMs: 250,
};

let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };

// ─── DOM References ───────────────────────────────────────────────────────────

const getEl = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id) as T | null;
    if (!el) {
        throw new Error(`Expected element #${id} to exist`);
    }
    return el;
};

// ─── Grid rendering ───────────────────────────────────────────────────────────

/**
 * Renders N empty slots in the grid container.
 * Replaces any existing slots — call this on init and after settings change.
 */
export const renderGrid = (count: number): void => {
    const grid = getEl("gif-grid");
    grid.innerHTML = "";
    slots.length = 0;

    for (let i = 0; i < count; i++) {
        const el = buildEmptySlot(i);
        grid.appendChild(el);
        slots.push({ el, state: "empty", blobUrl: null });
    }
};

const buildEmptySlot = (index: number): HTMLElement => {
    const el = document.createElement("div");
    el.className =
        "relative aspect-video rounded-xl bg-zinc-900 border-2 border-dashed border-zinc-700 " +
        "flex items-center justify-center overflow-hidden transition-all duration-200";
    el.dataset.slotIndex = String(index);
    el.innerHTML = `
        <span class="text-zinc-600 text-xs font-mono select-none">${index + 1}</span>
    `;
    return el;
};

// ─── Slot state transitions ────────────────────────────────────────────────────

/** Transitions a slot into the "capturing" state with animated border pulse. */
export const setSlotCapturing = (index: number): void => {
    const slot = slots[index];
    if (!slot) {
        return;
    }
    slot.state = "capturing";
    slot.el.className =
        "relative aspect-video rounded-xl bg-zinc-900 border-2 overflow-hidden " +
        "transition-all duration-200 slot-capturing";
    slot.el.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span class="text-2xl">📸</span>
            <span id="slot-cap-text-${index}" class="text-xs text-cyan-400 font-medium">Capturing…</span>
        </div>
    `;
};

/** Updates the "Capturing N/M" text inside a capturing slot. */
export const updateCaptureProgress = (index: number, captured: number, total: number): void => {
    const el = document.getElementById(`slot-cap-text-${index}`);
    if (el) {
        el.textContent = `Capturing ${captured}/${total}`;
    }
};

/** Transitions a slot into the "encoding" state with a progress bar. */
export const setSlotEncoding = (index: number): void => {
    const slot = slots[index];
    if (!slot) {
        return;
    }
    slot.state = "encoding";
    slot.el.className =
        "relative aspect-video rounded-xl bg-zinc-900 border-2 border-violet-500 overflow-hidden " +
        "transition-all duration-200";
    slot.el.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
            <span class="text-xs text-violet-400 font-medium">Encoding…</span>
            <div class="w-full h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                <div
                    id="slot-progress-${index}"
                    class="h-full rounded-full bg-violet-500 transition-all duration-150"
                    style="width: 0%"
                ></div>
            </div>
            <span id="slot-pct-${index}" class="text-xs text-zinc-500 font-mono">0%</span>
        </div>
    `;
};

/** Updates the progress bar inside an encoding slot. */
export const setProgress = (index: number, percent: number): void => {
    const bar = document.getElementById(`slot-progress-${index}`);
    const pct = document.getElementById(`slot-pct-${index}`);
    if (bar) {
        bar.style.width = `${percent}%`;
    }
    if (pct) {
        pct.textContent = `${percent}%`;
    }
};

/** Transitions a slot into the "complete" state, showing the animated GIF. */
export const displayGif = (index: number, blobUrl: string): void => {
    const slot = slots[index];
    if (!slot) {
        return;
    }

    // Revoke previous blob URL if there was one (shouldn't happen on a fresh run,
    // but defensive for the case where a slot is reused).
    if (slot.blobUrl) {
        URL.revokeObjectURL(slot.blobUrl);
    }

    slot.state = "complete";
    slot.blobUrl = blobUrl;
    slot.el.className =
        "relative aspect-video rounded-xl bg-zinc-900 border-2 border-zinc-700 overflow-hidden " +
        "group transition-all duration-200 hover:border-zinc-500";
    slot.el.innerHTML = `
        <img
            src="${blobUrl}"
            class="w-full h-full object-cover gif-appear"
            alt="Animated GIF ${index + 1}"
        />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-end p-2">
            <button
                data-download-index="${index}"
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-200
                       px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20
                       backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1.5"
                title="Download GIF ${index + 1}"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Save
            </button>
        </div>
    `;
};

/** Transitions a slot into the "error" state. */
export const showError = (index: number, message: string): void => {
    const slot = slots[index];
    if (!slot) {
        return;
    }
    slot.state = "error";
    slot.el.className =
        "relative aspect-video rounded-xl bg-zinc-900 border-2 border-red-500/60 overflow-hidden " +
        "transition-all duration-200";
    slot.el.innerHTML = `
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
            <span class="text-xl">⚠️</span>
            <span class="text-xs text-red-400 leading-relaxed">${escapeHtml(message)}</span>
        </div>
    `;
};

/** Resets all slots to empty state and revokes any held Blob URLs. */
export const clearGrid = (): void => {
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.blobUrl) {
            URL.revokeObjectURL(slot.blobUrl);
            slot.blobUrl = null;
        }
        slot.state = "empty";
        // Replace slot element content with a fresh empty slot
        const fresh = buildEmptySlot(i);
        slot.el.className = fresh.className;
        slot.el.innerHTML = fresh.innerHTML;
    }
};

/** Returns true if at least one slot has a completed GIF. */
export const hasCompletedGifs = (): boolean =>
    slots.some(s => s.state === "complete" && s.blobUrl !== null);

/** Returns the blob URL for a completed slot, or null. */
export const getSlotBlobUrl = (index: number): string | null => slots[index]?.blobUrl ?? null;

/** Returns all completed slots as { index, blobUrl } pairs. */
export const getCompletedSlots = (): Array<{ index: number; blobUrl: string }> =>
    slots
        .map((s, i) => ({ index: i, blobUrl: s.blobUrl }))
        .filter((s): s is { index: number; blobUrl: string } => s.blobUrl !== null);

// ─── Camera error state ────────────────────────────────────────────────────────

/** Shows the camera-denied message and hides the video element. */
export const showCameraDenied = (): void => {
    getEl("camera-loading").classList.add("hidden");
    getEl("camera-video").classList.add("hidden");
    getEl("camera-denied").classList.remove("hidden");
    getEl("start-btn").setAttribute("disabled", "");
    setStatus("Camera access required.");
};

/** Hides the camera-denied message, shows the video element. */
export const showCameraActive = (): void => {
    getEl("camera-loading").classList.add("hidden");
    getEl("camera-denied").classList.add("hidden");
    getEl("camera-video").classList.remove("hidden");
    getEl("start-btn").removeAttribute("disabled");
    setStatus("Ready. Adjust settings and hit Start.");
};

/** Shows the camera loading state (initial state before getUserMedia resolves). */
export const showCameraLoading = (): void => {
    getEl("camera-loading").classList.remove("hidden");
    getEl("camera-denied").classList.add("hidden");
    getEl("camera-video").classList.add("hidden");
    setStatus("Initializing camera…");
};

// ─── Global error state ────────────────────────────────────────────────────────

/** Replaces the app with a full-page error message (for unrecoverable failures). */
export const showFatalError = (message: string): void => {
    const app = document.getElementById("app");
    if (!app) {
        return;
    }
    app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center p-6">
            <div class="max-w-sm text-center flex flex-col gap-4">
                <div class="text-5xl">💥</div>
                <h1 class="text-lg font-bold text-white">Something went wrong</h1>
                <p class="text-sm text-zinc-400">${escapeHtml(message)}</p>
                <button
                    onclick="location.reload()"
                    class="mt-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-medium transition-colors"
                >
                    Reload
                </button>
            </div>
        </div>
    `;
};

// ─── Controls state ────────────────────────────────────────────────────────────

/** Lock the UI into recording state — disables settings, changes button label. */
export const setRecordingState = (recording: boolean): void => {
    const startBtn = getEl("start-btn");
    const clearBtn = getEl("clear-btn");
    const downloadAllBtn = getEl("download-all-btn");
    const settingsFields = getEl("settings-fields");
    const recordingIndicator = getEl("recording-indicator");

    if (recording) {
        startBtn.setAttribute("disabled", "");
        startBtn.textContent = "Recording…";
        clearBtn.classList.add("hidden");
        downloadAllBtn.classList.add("hidden");
        settingsFields.setAttribute("inert", "");
        recordingIndicator.classList.remove("hidden");
    } else {
        startBtn.removeAttribute("disabled");
        startBtn.textContent = "Start Recording";
        settingsFields.removeAttribute("inert");
        recordingIndicator.classList.add("hidden");

        // Show clear/download buttons only if there's something to clear/download
        if (hasCompletedGifs()) {
            clearBtn.classList.remove("hidden");
            downloadAllBtn.classList.remove("hidden");
        }
    }
};

/** Update the status line beneath the controls. */
export const setStatus = (text: string): void => {
    const el = getEl("status-text");
    el.textContent = text;
};

// ─── Settings panel ────────────────────────────────────────────────────────────

let settingsPanelOpen = false;

const openSettingsPanel = (): void => {
    settingsPanelOpen = true;
    getEl("settings-panel").classList.add("settings-open");
    getEl("settings-overlay").classList.remove("hidden");
    getEl("settings-overlay").setAttribute("aria-hidden", "false");
};

const closeSettingsPanel = (): void => {
    settingsPanelOpen = false;
    getEl("settings-panel").classList.remove("settings-open");
    getEl("settings-overlay").classList.add("hidden");
    getEl("settings-overlay").setAttribute("aria-hidden", "true");
};

const publishSettings = (): void => {
    // Fire-and-forget publish — main.ts subscribed to "ui.settings" to
    // update its internal state before the next recording run.
    channel.publish("ui.settings", { ...currentSettings });
};

const bindSettingsControls = (): void => {
    const gifCountInput = getEl<HTMLInputElement>("gif-count");
    const framesInput = getEl<HTMLInputElement>("frames-per-gif");
    const intervalInput = getEl<HTMLInputElement>("capture-interval");
    const delayInput = getEl<HTMLInputElement>("playback-delay");

    const gifCountVal = getEl("gif-count-val");
    const framesVal = getEl("frames-per-gif-val");
    const intervalVal = getEl("capture-interval-val");
    const delayVal = getEl("playback-delay-val");

    gifCountInput.addEventListener("input", () => {
        const val = clamp(Number(gifCountInput.value), 1, 25);
        currentSettings.gifCount = val;
        gifCountVal.textContent = String(val);
        renderGrid(val);
        publishSettings();
    });

    framesInput.addEventListener("input", () => {
        const val = clamp(Number(framesInput.value), 2, 30);
        currentSettings.framesPerGif = val;
        framesVal.textContent = String(val);
        publishSettings();
    });

    intervalInput.addEventListener("input", () => {
        const val = Number(intervalInput.value);
        currentSettings.captureIntervalMs = val;
        intervalVal.textContent = `${val}ms`;
        publishSettings();
    });

    delayInput.addEventListener("input", () => {
        const val = Number(delayInput.value);
        currentSettings.playbackDelayMs = val;
        delayVal.textContent = `${val}ms`;
        publishSettings();
    });
};

// ─── Download helpers ─────────────────────────────────────────────────────────

/** Triggers a browser download for a single GIF slot. */
export const downloadSingleGif = (index: number): void => {
    const blobUrl = getSlotBlobUrl(index);
    if (!blobUrl) {
        return;
    }
    triggerDownload(blobUrl, `gif-stitch-${index + 1}.gif`);
};

/** Triggers a download link click imperatively. Works cross-browser. */
const triggerDownload = (url: string, filename: string): void => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

// ─── Main init ─────────────────────────────────────────────────────────────────

/**
 * Initialises all UI event bindings and returns the current settings.
 * Call this once from main.ts after the DOM is ready.
 */
export const initUI = (): AppSettings => {
    // Render initial grid
    renderGrid(currentSettings.gifCount);

    // Settings panel open/close
    getEl("settings-btn").addEventListener("click", openSettingsPanel);
    getEl("settings-close-btn").addEventListener("click", closeSettingsPanel);
    getEl("settings-overlay").addEventListener("click", closeSettingsPanel);

    // Keyboard escape to close settings
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && settingsPanelOpen) {
            closeSettingsPanel();
        }
    });

    bindSettingsControls();

    // Start button — publish "ui.start" so main.ts can kick off the capture loop
    getEl("start-btn").addEventListener("click", () => {
        channel.publish("ui.start", undefined);
    });

    // Clear button — revoke blob URLs and reset the grid
    getEl("clear-btn").addEventListener("click", () => {
        clearGrid();
        getEl("clear-btn").classList.add("hidden");
        getEl("download-all-btn").classList.add("hidden");
        setStatus("Ready. Adjust settings and hit Start.");
        channel.publish("ui.clear", undefined);
    });

    // Download-all button handled in main.ts (needs JSZip)
    // We just attach a placeholder; main.ts overwrites it via the returned handle.

    // Per-slot download buttons — delegated from the grid since slots are dynamic
    getEl("gif-grid").addEventListener("click", e => {
        const target = e.target as HTMLElement;
        const btn = target.closest("[data-download-index]") as HTMLElement | null;
        if (btn) {
            const idx = Number(btn.dataset.downloadIndex);
            downloadSingleGif(idx);
        }
    });

    // Subscribe to encode.progress here so the worker's progress publications
    // update the slot UI without going through main.ts.
    channel.subscribe(
        "encode.progress",
        (envelope: Envelope<{ index: number; percent: number }>) => {
            const { index, percent } = envelope.payload;
            setProgress(index, percent);
        }
    );

    return { ...currentSettings };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

/** Escapes HTML special characters for safe innerHTML insertion. */
const escapeHtml = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
