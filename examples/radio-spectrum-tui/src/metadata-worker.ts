// Metadata poller child process — Child 4.
//
// Responsibilities:
//   1. Connect to parent postal bus
//   2. Subscribe to radio.control.tune to track the active station ID
//   3. Poll https://somafm.com/channels.json every ~30 seconds
//   4. Filter to the active station and publish radio.station.meta
//   5. Clean shutdown on radio.control.quit

import { get } from "node:https";
import { getChannel, addTransport } from "postal";
import { connectToParent } from "postal-transport-childprocess";
import type { TuneCommand, StationMeta } from "./types.js";

const SOMAFM_API_URL = "https://somafm.com/channels.json";
const POLL_INTERVAL_MS = 30_000;

// Shape of a single channel object from the SomaFM API.
// Only the fields we care about — the actual response has many more.
type SomaFmChannel = {
    id: string;
    title: string;
    genre: string;
    description: string;
    listeners: string; // SomaFM returns this as a string
    /** "Artist - Title" string for the current track. */
    lastPlaying?: string;
};

type SomaFmResponse = {
    channels: SomaFmChannel[];
};

let activeStationId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Fetch and parse the SomaFM channels.json. Returns null on error. */
const fetchChannels = (): Promise<SomaFmChannel[] | null> =>
    new Promise(resolve => {
        get(SOMAFM_API_URL, res => {
            if (res.statusCode !== 200) {
                res.resume();
                resolve(null);
                return;
            }

            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on("end", () => {
                try {
                    const body = Buffer.concat(chunks).toString("utf-8");
                    const parsed = JSON.parse(body) as SomaFmResponse;
                    resolve(parsed.channels ?? null);
                } catch {
                    resolve(null);
                }
            });

            res.on("error", () => {
                resolve(null);
            });
        }).on("error", () => {
            resolve(null);
        });
    });

/** Find the active station in the channels list and publish its metadata. */
const pollAndPublish = async (publishFn: (meta: StationMeta) => void): Promise<void> => {
    if (activeStationId === null) {
        return;
    }

    const channels = await fetchChannels();
    if (channels === null) {
        return;
    }

    const channel = channels.find(c => c.id === activeStationId);
    if (!channel) {
        return;
    }

    const track = channel.lastPlaying || "Unknown track";

    publishFn({
        id: channel.id,
        name: channel.title,
        genre: channel.genre,
        track,
        listeners: parseInt(channel.listeners, 10) || 0,
        description: channel.description,
    });
};

const main = async (): Promise<void> => {
    const transport = await connectToParent();
    addTransport(transport);

    const postalChannel = getChannel("radio");

    // Closure over the postal channel so pollAndPublish doesn't need to
    // know about postal directly — keeps the fetch logic pure-ish.
    const publishMeta = (meta: StationMeta): void => {
        postalChannel.publish("radio.station.meta", meta);
    };

    postalChannel.subscribe("radio.control.#", envelope => {
        const topic = envelope.topic;

        if (topic === "radio.control.tune") {
            const payload = envelope.payload as TuneCommand;
            activeStationId = payload.stationId;

            // Fetch immediately on station change, then continue polling.
            void pollAndPublish(publishMeta);

            // Reset poll interval so we don't double-poll right after a tune.
            if (pollTimer !== null) {
                clearInterval(pollTimer);
            }
            pollTimer = setInterval(() => {
                void pollAndPublish(publishMeta);
            }, POLL_INTERVAL_MS);
        } else if (topic === "radio.control.quit") {
            if (pollTimer !== null) {
                clearInterval(pollTimer);
            }
            process.exit(0);
        }
    });
};

main().catch(err => {
    process.stderr.write(`[metadata-worker] Fatal: ${String(err)}\n`);
    process.exit(1);
});
