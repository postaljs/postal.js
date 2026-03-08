// Stream reader child process — Child 1.
//
// Responsibilities:
//   1. Connect back to the parent via postal IPC transport
//   2. Subscribe to radio.control.# for tune/audio/quit commands
//   3. On tune: open an HTTP GET to the Icecast stream URL, pipe through
//      ffmpeg (MP3 → raw PCM signed-16-bit LE 44100 Hz stereo)
//   4. Chunk decoded PCM into FFT_SIZE-sample buffers
//   5. Tee the PCM two ways:
//        a) Base64-encode and publish radio.audio.pcm for viz children
//        b) If audio is enabled, pipe raw bytes to sox `play`
//   6. Clean shutdown on radio.control.quit

import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { getChannel, addTransport } from "postal";
import { connectToParent } from "postal-transport-childprocess";
import type { TuneCommand, AudioCommand } from "./types.js";

// PCM format constants — must match the ffmpeg decode args below.
const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2; // signed 16-bit
const CHUNK_SAMPLES = 2048; // ~46ms at 44100 Hz
const CHUNK_BYTES = CHUNK_SAMPLES * CHANNELS * BYTES_PER_SAMPLE;

// ffmpeg decode pipeline: MP3 stream from stdin → raw PCM on stdout.
const FFMPEG_ARGS = [
    "-i",
    "pipe:0", // read from stdin
    "-f",
    "s16le", // signed 16-bit little-endian
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    String(CHANNELS),
    "pipe:1", // write to stdout
    "-loglevel",
    "error", // suppress noisy ffmpeg startup banners
];

// sox play args: accept raw PCM on stdin for audio output.
const PLAY_ARGS = [
    "-t",
    "raw",
    "-r",
    String(SAMPLE_RATE),
    "-e",
    "signed",
    "-b",
    "16",
    "-c",
    String(CHANNELS),
    "-", // read from stdin
];

/**
 * Mutable module-level state for the stream reader.
 *
 * Lives outside of any function so the HTTP callback, ffmpeg stdout handler,
 * and postal subscription handler can all access the same state without
 * passing it through closures. This is a child process with a single
 * execution context — no concurrency concerns beyond the event loop.
 */
type State = {
    /** Icecast stream URL for the currently tuned station. */
    currentUrl: string | null;
    /** SomaFM station ID (e.g. "groovesalad") for the current tune. */
    currentStationId: string | null;
    /** The running ffmpeg decode process (MP3 → raw PCM). */
    ffmpegProcess: ChildProcess | null;
    /** The running sox play process (raw PCM → audio output). */
    playProcess: ChildProcess | null;
    /** The active HTTP request — destroyed on retune to close the old socket. */
    currentRequest: http.ClientRequest | null;
    /** The active HTTP response — destroyed on retune to stop the old data flow. */
    currentResponse: http.IncomingMessage | null;
    /** True when the parent has sent radio.control.audio with enabled=true. */
    audioEnabled: boolean;
    /** Accumulator for partial PCM chunks from ffmpeg before they reach CHUNK_BYTES. */
    pcmAccumulator: Buffer[];
    /** Running byte count of data in pcmAccumulator. */
    accumulatedBytes: number;
};

const state: State = {
    currentUrl: null,
    currentStationId: null,
    ffmpegProcess: null,
    playProcess: null,
    currentRequest: null,
    currentResponse: null,
    audioEnabled: false,
    pcmAccumulator: [],
    accumulatedBytes: 0,
};

/** Kill a subprocess without throwing if it's already gone. */
const killProcess = (proc: ChildProcess | null): void => {
    if (proc === null) {
        return;
    }
    try {
        proc.kill("SIGKILL");
    } catch {
        // Already dead — nothing to do.
    }
};

/** Spawn a sox play process, piping its stdin from the caller. */
const spawnPlayProcess = (): ChildProcess => {
    const play = spawn("play", PLAY_ARGS, {
        stdio: ["pipe", "ignore", "ignore"],
    });
    play.on("error", err => {
        // Log but don't crash — audio is optional.
        process.stderr.write(`[stream-reader] play error: ${err.message}\n`);
    });
    // Swallow EPIPE on stdin — same as ffmpeg.stdin, the play process can
    // die while we're writing PCM to it (e.g. audio device lock conflict).
    play.stdin?.on("error", () => {});
    return play;
};

/** Ensure a sox play process is running (spawns one if needed). */
const ensurePlayProcess = (): void => {
    if (state.playProcess !== null) {
        return;
    }
    state.playProcess = spawnPlayProcess();
};

/** Kill the sox play process — only on station switch or quit. */
const teardownPlayProcess = (): void => {
    killProcess(state.playProcess);
    state.playProcess = null;
};

/** Reset PCM accumulator state. */
const resetAccumulator = (): void => {
    state.pcmAccumulator = [];
    state.accumulatedBytes = 0;
};

/**
 * Connect to an Icecast stream, pipe through ffmpeg, and process PCM output.
 *
 * The HTTP response body is piped directly into ffmpeg's stdin. ffmpeg's
 * stdout produces decoded PCM which we accumulate and chunk. Each full chunk
 * is teed to the postal bus (as base64) and optionally to sox play.
 *
 * We use http.request() (not createConnection) so an actual HTTP GET with
 * headers is sent — createConnection only opens a raw TCP socket.
 */
/** HTTP timeout for connecting to Icecast streams (ms). */
const HTTP_TIMEOUT_MS = 10_000;

const startStream = (url: string, publishFn: (samples: string) => void): void => {
    const parsed = new URL(url);
    process.stderr.write(`[stream-reader] connecting to ${parsed.hostname}${parsed.pathname}\n`);

    const req = http.request(
        {
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port, 10) : 80,
            path: parsed.pathname + (parsed.search ?? ""),
            method: "GET",
            // Disable connection pooling — reusing a pooled socket after
            // destroy() on the previous request causes the next request to hang.
            agent: false,
            // Timeout covers the gap between opening the socket and receiving
            // the HTTP response headers. Without this, a hung Icecast server
            // stalls the app forever with no error.
            timeout: HTTP_TIMEOUT_MS,
            headers: {
                "icy-metadata": "1",
                "User-Agent": "postal-radio-spectrum/0.0.1",
            },
        },
        res => {
            process.stderr.write(`[stream-reader] HTTP ${res.statusCode} — spawning ffmpeg\n`);
            state.currentResponse = res;

            const ffmpeg = spawn("ffmpeg", FFMPEG_ARGS, {
                stdio: ["pipe", "pipe", "ignore"],
            });
            state.ffmpegProcess = ffmpeg;

            ffmpeg.on("error", err => {
                process.stderr.write(`[stream-reader] ffmpeg error: ${err.message}\n`);
            });

            // Swallow EPIPE errors that fire when we kill ffmpeg during a retune.
            // Without this handler, the write in res.on("data") can crash the
            // process with an unhandled stream error.
            ffmpeg.stdin?.on("error", () => {});

            let firstPcm = true;

            // Pipe HTTP response body into ffmpeg stdin.
            res.on("data", (chunk: Buffer) => {
                if (ffmpeg.stdin !== null && !ffmpeg.stdin.destroyed) {
                    ffmpeg.stdin.write(chunk);
                }
            });

            res.on("end", () => {
                process.stderr.write("[stream-reader] HTTP response ended\n");
                if (ffmpeg.stdin !== null) {
                    ffmpeg.stdin.end();
                }
            });

            res.on("error", err => {
                process.stderr.write(`[stream-reader] response error: ${err.message}\n`);
            });

            // Process PCM output from ffmpeg stdout.
            ffmpeg.stdout?.on("data", (chunk: Buffer) => {
                if (firstPcm) {
                    firstPcm = false;
                    process.stderr.write("[stream-reader] first PCM chunk from ffmpeg\n");
                }

                state.pcmAccumulator.push(chunk);
                state.accumulatedBytes += chunk.length;

                // Process all full chunks from the accumulator.
                while (state.accumulatedBytes >= CHUNK_BYTES) {
                    const combined = Buffer.concat(state.pcmAccumulator);
                    const chunkBuf = combined.subarray(0, CHUNK_BYTES);
                    const remainder = combined.subarray(CHUNK_BYTES);

                    // Tee 1: publish as base64 for visualization workers.
                    publishFn(chunkBuf.toString("base64"));

                    // Tee 2: pipe raw bytes to sox play if audio is enabled.
                    if (
                        state.audioEnabled &&
                        state.playProcess !== null &&
                        state.playProcess.stdin !== null &&
                        !state.playProcess.stdin.destroyed
                    ) {
                        state.playProcess.stdin.write(chunkBuf);
                    }

                    state.pcmAccumulator = remainder.length > 0 ? [remainder] : [];
                    state.accumulatedBytes = remainder.length;
                }
            });

            ffmpeg.on("exit", (code, signal) => {
                process.stderr.write(
                    `[stream-reader] ffmpeg exited (code=${code}, signal=${signal})\n`
                );
            });
        }
    );

    state.currentRequest = req;

    // Timeout fires when the server doesn't respond within HTTP_TIMEOUT_MS.
    // The 'timeout' option above only sets the socket timeout — we still need
    // to explicitly abort the request when it fires.
    req.on("timeout", () => {
        process.stderr.write(
            `[stream-reader] HTTP timeout after ${HTTP_TIMEOUT_MS}ms — aborting\n`
        );
        req.destroy(new Error("HTTP timeout"));
    });

    req.on("error", err => {
        process.stderr.write(`[stream-reader] HTTP error: ${err.message}\n`);
    });

    req.end(); // send the GET request
};

/**
 * Tear down the current audio pipeline and start a fresh one for a new station.
 *
 * Order matters: destroy the HTTP response first (stops data flow), then the
 * request (closes the socket), then kill ffmpeg, then start the new stream.
 * Play is killed and respawned because it needs a fresh stdin pipe connected
 * to the new ffmpeg process — you can't reattach an existing pipe.
 */
const tune = (url: string, stationId: string, publishFn: (samples: string) => void): void => {
    process.stderr.write(`[stream-reader] tune → ${stationId}\n`);

    // Destroy the HTTP response stream first — stops data flowing to old ffmpeg.
    state.currentResponse?.destroy();
    state.currentResponse = null;

    // Destroy the HTTP request/socket to close the old connection entirely.
    state.currentRequest?.destroy();
    state.currentRequest = null;

    killProcess(state.ffmpegProcess);
    state.ffmpegProcess = null;
    resetAccumulator();

    state.currentUrl = url;
    state.currentStationId = stationId;

    // Start the stream first so ffmpeg is ready to receive PCM before sox plays.
    // Spawning play before any data is available results in an immediate underrun.
    startStream(url, publishFn);

    // Kill and respawn play on station switch — needs a fresh stdin for the
    // new ffmpeg pipeline. This is the only place play gets killed.
    teardownPlayProcess();
    if (state.audioEnabled) {
        ensurePlayProcess();
    }
};

// --- Main ---

const main = async (): Promise<void> => {
    const transport = await connectToParent();
    addTransport(transport);

    const channel = getChannel("radio");

    // Capture publish in a closure so tune() and the PCM loop can call it.
    const publishPcm = (samples: string): void => {
        channel.publish("radio.audio.pcm", { samples, channels: 2, rate: 44100 });
    };

    channel.subscribe("radio.control.#", envelope => {
        const topic = envelope.topic;

        if (topic === "radio.control.tune") {
            const payload = envelope.payload as TuneCommand;
            tune(payload.url, payload.stationId, publishPcm);
        } else if (topic === "radio.control.audio") {
            const payload = envelope.payload as AudioCommand;
            state.audioEnabled = payload.enabled;
            if (payload.enabled) {
                ensurePlayProcess();
            }
        } else if (topic === "radio.control.quit") {
            killProcess(state.ffmpegProcess);
            teardownPlayProcess();
            process.exit(0);
        }
    });
};

main().catch(err => {
    process.stderr.write(`[stream-reader] Fatal: ${String(err)}\n`);
    process.exit(1);
});
