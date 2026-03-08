// App — root Ink component for the radio spectrum TUI.
//
// Owns station navigation state and wires together the hooks and components.
// Postal subscriptions flow: child processes → hooks → state → components.

import React, { useState, useRef, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { getChannel } from "postal";
import { useChildProcesses } from "./hooks/useChildProcesses.js";
import { usePostalSubscription } from "./hooks/usePostalSubscription.js";
import { useBusActivity } from "./hooks/useBusActivity.js";
import { Header } from "./components/Header.js";
import { SpectrumPane } from "./components/SpectrumPane.js";
import { WaveformPane } from "./components/WaveformPane.js";
import { VuMeters } from "./components/VuMeters.js";
import { Footer } from "./components/Footer.js";
import { STATIONS, DEFAULT_STATION_INDEX, nextStation, prevStation } from "./stations.js";
import type {
    SpectrumPayload,
    WaveformPayload,
    LevelsPayload,
    StationMeta,
    LevelData,
} from "./types.js";

// Fixed layout heights for computing available spectrum pane space.
// The spectrum pane gets whatever vertical space is left after the
// fixed-height elements (header, waveform, VU, footer) are accounted for.
const WAVEFORM_PANE_HEIGHT = 7; // 5 content rows + 2 border rows
const VU_HEIGHT = 2; // L + R meter lines
const HEADER_HEIGHT = 3; // title, nav, genre/listeners
const FOOTER_HEIGHT = 1; // track + key hints
const MIN_SPECTRUM_CONTENT_HEIGHT = 4; // below this, hide the pane entirely
const MAX_SPECTRUM_CONTENT_HEIGHT = 20; // cap so it doesn't dominate on tall terminals
const SPECTRUM_BORDER_ROWS = 2; // top + bottom box-drawing borders
const SPECTRUM_LABEL_ROW = 1; // frequency label row inside the border

/** Maximum width for the waveform scroll buffer (inner pane width). */
const MAX_WAVEFORM_BUFFER = 400;

export type AppProps = {
    /** Whether --play was passed on the command line (enables sox audio output). */
    playAudio: boolean;
};

const DEFAULT_LEVELS: LevelData = { rms: 0, peak: 0 };

const App: React.FC<AppProps> = ({ playAudio }) => {
    const { exit } = useApp();
    const { stdout } = useStdout();

    const termWidth = stdout?.columns ?? 80;
    const termRows = stdout?.rows ?? 24;

    const [stationIndex, setStationIndex] = useState(DEFAULT_STATION_INDEX);

    // Waveform buffer lives in a ref — updated on every PCM chunk but only
    // read on the 33ms throttle tick that triggers re-render.
    const waveformBufferRef = useRef<number[]>([]);

    const { connected, error } = useChildProcesses(playAudio);
    const busActivity = useBusActivity();

    // Pass stationIndex as resetKey so stale data from the old station is
    // cleared immediately on tune — mirrors the reference version's explicit
    // displayState.spectrumBins = [] / stationMeta = null on station change.
    const spectrumPayload = usePostalSubscription<SpectrumPayload>(
        "radio",
        "radio.viz.spectrum",
        stationIndex
    );
    const waveformPayload = usePostalSubscription<WaveformPayload>(
        "radio",
        "radio.viz.waveform",
        stationIndex
    );
    const levelsPayload = usePostalSubscription<LevelsPayload>(
        "radio",
        "radio.viz.levels",
        stationIndex
    );
    const stationMeta = usePostalSubscription<StationMeta>(
        "radio",
        "radio.station.meta",
        stationIndex
    );

    // Append incoming waveform samples to the scrolling buffer only when a
    // new payload arrives — not on every re-render. Running this in the render
    // body would cause double-appends when unrelated state updates trigger
    // extra renders (e.g. station navigation).
    useEffect(() => {
        if (!waveformPayload?.samples) {
            return;
        }
        for (const s of waveformPayload.samples) {
            waveformBufferRef.current.push(s);
        }
        if (waveformBufferRef.current.length > MAX_WAVEFORM_BUFFER) {
            waveformBufferRef.current.splice(
                0,
                waveformBufferRef.current.length - MAX_WAVEFORM_BUFFER
            );
        }
    }, [waveformPayload]);

    const channel = getChannel("radio");
    const station = STATIONS[stationIndex];

    /** Switch to a station by index — clears stale viz data and publishes a tune command. */
    const tuneToStation = (index: number): void => {
        setStationIndex(index);
        waveformBufferRef.current = [];
        channel.publish("radio.control.tune", {
            url: STATIONS[index].url,
            stationId: STATIONS[index].id,
        });
    };

    // Tune to default station once connected. Using a ref + effect instead of
    // the render body avoids calling setState (inside tuneToStation) during render.
    const hasConnectedRef = useRef(false);
    useEffect(() => {
        if (connected && !hasConnectedRef.current) {
            hasConnectedRef.current = true;
            tuneToStation(DEFAULT_STATION_INDEX);
            if (playAudio) {
                channel.publish("radio.control.audio", { enabled: true });
            }
        }
    }, [connected]);

    useInput((input, key) => {
        if (input === "q" || (key.ctrl && input === "c")) {
            // Broadcast quit so children can clean up (kill ffmpeg, close HTTP, etc.)
            // then give them 300ms before Ink tears down the process tree.
            channel.publish("radio.control.quit", {});
            setTimeout(() => {
                exit();
            }, 300);
            return;
        }
        if (key.rightArrow) {
            const next = nextStation(stationIndex);
            tuneToStation(next);
            return;
        }
        if (key.leftArrow) {
            const prev = prevStation(stationIndex);
            tuneToStation(prev);
            return;
        }
    });

    // The spectrum pane is the only variable-height element — it gets whatever
    // vertical space is left after fixed-height elements are placed.
    const fixedRows = HEADER_HEIGHT + WAVEFORM_PANE_HEIGHT + VU_HEIGHT + FOOTER_HEIGHT;
    const spectrumContentHeight = termRows - fixedRows - SPECTRUM_BORDER_ROWS - SPECTRUM_LABEL_ROW;
    const spectrumVisible = spectrumContentHeight >= MIN_SPECTRUM_CONTENT_HEIGHT;
    const spectrumHeight = spectrumVisible
        ? Math.min(spectrumContentHeight, MAX_SPECTRUM_CONTENT_HEIGHT)
        : 0;

    const bins = spectrumPayload?.bins ?? [];
    const leftLevel = levelsPayload?.left ?? DEFAULT_LEVELS;
    const rightLevel = levelsPayload?.right ?? DEFAULT_LEVELS;

    if (error !== null) {
        return (
            <Box flexDirection="column">
                <Text color="red">Error: {error}</Text>
                <Footer stationMeta={null} />
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            <Header
                station={station}
                stationIndex={stationIndex}
                stationCount={STATIONS.length}
                stationMeta={stationMeta}
                busActivity={busActivity}
                audioEnabled={playAudio}
            />
            {spectrumVisible && (
                <SpectrumPane bins={bins} width={termWidth} height={spectrumHeight} />
            )}
            <WaveformPane samples={waveformBufferRef.current} width={termWidth} />
            <VuMeters leftLevel={leftLevel} rightLevel={rightLevel} width={termWidth - 2} />
            <Footer stationMeta={stationMeta} />
        </Box>
    );
};

export default App;
