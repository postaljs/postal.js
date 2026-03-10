// useChildProcesses — fork, connect, and manage the four radio children.
//
// Mirrors the child process lifecycle from main.ts in the original example,
// lifted into a React hook so it integrates with Ink's render lifecycle.
//
// The PCM relay lives here: the parent must re-publish radio.audio.pcm
// so spectrum-worker and waveform-worker receive it. The postal IPC transport
// delivers inbound messages locally but doesn't re-broadcast to other transports,
// so the parent must explicitly forward PCM. The source guard prevents loops.

import { useEffect, useState } from "react";
import { fork, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getChannel, addTransport } from "postal";
import { connectToChild } from "postal-transport-childprocess";
import { checkCommand } from "../lib/check-command.js";
import type { PcmPayload } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Child scripts live one level up (src/) from this file (src/hooks/).
const SRC_DIR = join(__dirname, "..");

const CHILD_PATHS = {
    streamReader: join(SRC_DIR, "stream-reader.ts"),
    spectrumWorker: join(SRC_DIR, "spectrum-worker.ts"),
    waveformWorker: join(SRC_DIR, "waveform-worker.ts"),
    metadataWorker: join(SRC_DIR, "metadata-worker.ts"),
};

export type ChildProcessesState = {
    connected: boolean;
    error: string | null;
};

/**
 * Fork a child process using tsx so it can run .ts source files directly.
 * Inherits execArgv so the tsx loader carries over from the parent.
 *
 * Child stderr is buffered — NOT piped to the terminal — because Ink tracks
 * its own output height via cursor-up sequences. Any interleaved stderr lines
 * corrupt Ink's cursor math and cause stacked/duplicated frames.
 * The buffer is dumped to stderr on child exit so diagnostic logs are visible
 * after the app shuts down.
 */
const forkChild = (scriptPath: string): ChildProcess => {
    const child = fork(scriptPath, [], {
        execArgv: [...process.execArgv],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const stderrChunks: Buffer[] = [];
    child.stderr?.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
    });
    child.on("exit", () => {
        // Always dump buffered stderr so diagnostic logs are visible.
        if (stderrChunks.length > 0) {
            process.stderr.write(Buffer.concat(stderrChunks));
        }
    });
    return child;
};

/**
 * Establish a postal IPC transport with a child process.
 *
 * connectToChild performs a SYN/ACK handshake over Node's IPC channel,
 * then returns a transport object. addTransport registers it with the
 * local postal instance so published messages are forwarded to (and from)
 * the child. The transport is automatically removed when the child exits
 * to avoid sending messages to a dead process.
 */
const connectChild = async (child: ChildProcess): Promise<boolean> => {
    try {
        const transport = await connectToChild(child);
        const removeTransport = addTransport(transport);
        child.on("exit", removeTransport);
        return true;
    } catch {
        return false;
    }
};

/**
 * Fork all four children, connect postal transports, relay PCM for fan-out.
 * Returns connection status so App can show a loading state.
 * Cleanup publishes radio.control.quit and kills children on unmount.
 */
export const useChildProcesses = (playAudio: boolean): ChildProcessesState => {
    const [state, setState] = useState<ChildProcessesState>({
        connected: false,
        error: null,
    });

    useEffect(() => {
        const children: ChildProcess[] = [];
        let cleanedUp = false;

        const cleanup = (): void => {
            if (cleanedUp) {
                return;
            }
            cleanedUp = true;

            const channel = getChannel("radio");
            channel.publish("radio.control.quit", {});

            setTimeout(() => {
                for (const child of children) {
                    try {
                        child.kill("SIGKILL");
                    } catch {
                        // Already dead — nothing to do.
                    }
                }
            }, 300);
        };

        const init = async (): Promise<void> => {
            const hasFFmpeg = await checkCommand("ffmpeg");
            // Bail early if cleanup was already called while we were awaiting.
            if (cleanedUp) {
                return;
            }
            if (!hasFFmpeg) {
                setState({
                    connected: false,
                    error: "ffmpeg not found in PATH. Install: brew install ffmpeg (macOS) / apt install ffmpeg (Linux)",
                });
                return;
            }

            if (playAudio) {
                const hasSox = await checkCommand("play");
                if (cleanedUp) {
                    return;
                }
                if (!hasSox) {
                    setState({
                        connected: false,
                        error: "sox 'play' not found in PATH. Install: brew install sox (macOS) / apt install sox (Linux). Or omit --play to run as a silent visualizer.",
                    });
                    return;
                }
            }

            // Guard again before forking — unmount may have fired during the awaits above.
            if (cleanedUp) {
                return;
            }

            const streamReader = forkChild(CHILD_PATHS.streamReader);
            const spectrumWorker = forkChild(CHILD_PATHS.spectrumWorker);
            const waveformWorker = forkChild(CHILD_PATHS.waveformWorker);
            const metadataWorker = forkChild(CHILD_PATHS.metadataWorker);

            children.push(streamReader, spectrumWorker, waveformWorker, metadataWorker);

            const [streamReaderOk] = await Promise.all([
                connectChild(streamReader),
                connectChild(spectrumWorker),
                connectChild(waveformWorker),
                connectChild(metadataWorker),
            ]);

            if (cleanedUp) {
                return;
            }

            if (!streamReaderOk) {
                setState({
                    connected: false,
                    error: "stream-reader failed to connect. Cannot continue.",
                });
                cleanup();
                return;
            }

            // Viz workers are non-critical — continue without them.
            // No stderr writes here — they corrupt Ink's cursor tracking.

            const channel = getChannel("radio");

            // Relay PCM from stream-reader to the viz workers.
            // Source guard prevents infinite loops — only forward transport-originated messages.
            channel.subscribe("radio.audio.pcm", envelope => {
                if (envelope.source) {
                    channel.publish("radio.audio.pcm", envelope.payload as PcmPayload);
                }
            });

            setState({ connected: true, error: null });

            // If all children exit, trigger cleanup.
            let exitCount = 0;
            for (const child of children) {
                child.on("exit", () => {
                    exitCount++;
                    if (exitCount >= children.length && !cleanedUp) {
                        cleanup();
                    }
                });
            }
        };

        void init();

        return cleanup;
    }, [playAudio]);

    return state;
};
