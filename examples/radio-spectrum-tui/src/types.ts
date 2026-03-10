// Shared types for the radio spectrum analyzer example.
//
// Keep this module free of any Node.js or postal runtime imports so it can
// be safely imported by both parent and child processes without side effects.
//
// The ChannelRegistry augmentation tells postal what payload types flow on
// each topic of the "radio" channel — compile-time only, no runtime cost.

/** Level data for a single audio channel (left or right). */
export type LevelData = {
    /** Root-mean-square level, normalized 0–1. */
    rms: number;
    /** Peak level, normalized 0–1. Decays slowly (classic VU peak-hold behavior). */
    peak: number;
};

/** Raw PCM audio chunk published by the stream reader. */
export type PcmPayload = {
    /** Base64-encoded signed 16-bit LE PCM samples, interleaved stereo. */
    samples: string;
    /** Always 2 — stereo. Typed explicitly for clarity in consumers. */
    channels: 2;
    /** Sample rate — always 44100 Hz. */
    rate: 44100;
};

/** Frequency bin magnitudes published by the spectrum analyzer. */
export type SpectrumPayload = {
    /** Normalized bar heights, one per display column. Each value is 0–1. */
    bins: number[];
};

/** Downsampled waveform published by the waveform worker. */
export type WaveformPayload = {
    /** Normalized PCM amplitudes, one per display column. Each value is -1 to 1. */
    samples: number[];
};

/** Stereo VU meter levels published by the waveform worker. */
export type LevelsPayload = {
    left: LevelData;
    right: LevelData;
};

/** Station metadata published by the metadata poller. */
export type StationMeta = {
    /** SomaFM channel ID (e.g. "groovesalad"). */
    id: string;
    /** Station display name. */
    name: string;
    /** Genre description. */
    genre: string;
    /** Currently playing track (artist — title). */
    track: string;
    /** Active listener count. */
    listeners: number;
    /** Station description (longer text). */
    description: string;
};

/** ICY metadata extracted from the Icecast HTTP headers. */
export type IcyMetaPayload = {
    /** Station name from the ICY headers. */
    name: string;
};

/** Tune command published by the parent to switch stations. */
export type TuneCommand = {
    /** Icecast stream URL to connect to. */
    url: string;
    /** SomaFM station ID — used by the metadata poller to filter channels.json. */
    stationId: string;
};

/** Audio enable/disable command published by the parent. */
export type AudioCommand = {
    /** True = start sox play; false = kill sox play. */
    enabled: boolean;
};

// --- Channel registry augmentation ---
//
// Wildcard subscriptions used in this example:
//   parent: radio.viz.#      — all visualization data
//   parent: radio.station.#  — all metadata updates
//   children: radio.control.# — tuning and shutdown

declare module "postal" {
    interface ChannelRegistry {
        radio: {
            "radio.audio.pcm": PcmPayload;
            "radio.viz.spectrum": SpectrumPayload;
            "radio.viz.waveform": WaveformPayload;
            "radio.viz.levels": LevelsPayload;
            "radio.station.meta": StationMeta;
            "radio.station.icymeta": IcyMetaPayload;
            "radio.control.tune": TuneCommand;
            "radio.control.audio": AudioCommand;
            "radio.control.quit": Record<string, never>;
        };
    }
}
