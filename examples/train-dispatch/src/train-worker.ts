// Train worker — runs inside a Node.js worker thread.
//
// Each worker manages one train's full journey lifecycle:
//   SCHEDULED → ON TIME → BOARDING → DEPARTED → (cycling)
//
// Random delays are injected with low probability to create emergent
// behaviour without scripted scenarios. Dispatch commands from the main
// thread can hold or reassign the platform.
//
// We use top-level await because tsx/Node ESM workers support it.

import { workerData } from "node:worker_threads";
import { getChannel, addTransport } from "postal";
import { connectFromWorkerThread } from "postal-transport-messageport/node";
// Importing from types.js also activates the ChannelRegistry augmentation,
// so getChannel("train-dispatch") returns a fully typed channel automatically.
import type { WorkerInitData, TrainStatusPayload, TrainStatus, PlatformPayload } from "./types.js";
// .ts extension intentional — tsx resolves worker imports from source directly,
// skipping the compiled output. Using .js here would fail at runtime.
import { simMinutesToMs, randInt } from "./train-worker-utils.ts";

const { route, simStartMs, msPerSimMinute }: WorkerInitData = workerData;

// --- Timing helpers ---

/** Await a real-time delay. */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// --- Worker state ---

type WorkerState = {
    platform: number;
    delayMinutes: number;
    held: boolean;
    status: TrainStatus;
    /** Resolves when a hold is cleared. Only set while held. */
    holdRelease: (() => void) | null;
};

const state: WorkerState = {
    platform: route.platform,
    delayMinutes: 0,
    held: false,
    status: "SCHEDULED",
    holdRelease: null,
};

// --- Connect transport ---

const transport = await connectFromWorkerThread();
addTransport(transport);

const channel = getChannel("train-dispatch");

// --- Dispatch command subscription ---
// Workers subscribe to dispatch.<id>.* to receive hold/clear/platform commands.

channel.subscribe(`dispatch.${route.id}.*`, envelope => {
    const topic: string = envelope.topic;

    if (topic.endsWith(".hold")) {
        // Only honour a hold if we're in a holdable state (not yet departed).
        state.held = true;
    } else if (topic.endsWith(".clear")) {
        state.held = false;
        if (state.holdRelease) {
            state.holdRelease();
            state.holdRelease = null;
        }
    } else if (topic.endsWith(".platform")) {
        const payload: PlatformPayload = envelope.payload as PlatformPayload;
        // Only accept platform reassignment before boarding — after that the
        // train is committed and it's operationally too late.
        const preBoarding: TrainStatus[] = ["SCHEDULED", "ON TIME", "DELAYED", "HELD"];
        if (preBoarding.includes(state.status)) {
            state.platform = payload.platform;
        }
    }
});

// --- Journey helpers ---

const publish = (status: TrainStatusPayload): void => {
    channel.publish(`train.${route.id}.status`, status);
};

/** Wait while the train is held, resolving when cleared. */
const waitForClear = (): Promise<void> =>
    new Promise(resolve => {
        if (!state.held) {
            resolve();
            return;
        }
        state.holdRelease = resolve;
    });

// --- Journey state machine ---

const runJourney = async (): Promise<void> => {
    // Publish initial SCHEDULED status immediately on startup.
    state.status = "SCHEDULED";
    publish({
        id: route.id,
        status: "SCHEDULED",
        scheduledTime: route.scheduledTime,
        platform: state.platform,
    });

    // Wait until the train's boarding window opens (relative to sim start).
    const boardingDelay =
        simStartMs + simMinutesToMs(route.boardingAtMinute, msPerSimMinute) - Date.now();
    if (boardingDelay > 0) {
        await sleep(boardingDelay);
    }

    // Randomly inject a delay ~25% of the time.
    if (Math.random() < 0.25) {
        state.delayMinutes = randInt(2, 15);
    }

    if (state.delayMinutes > 0) {
        state.status = "DELAYED";
        publish({
            id: route.id,
            status: "DELAYED",
            scheduledTime: route.scheduledTime,
            platform: state.platform,
            delay: state.delayMinutes,
            remarks: `+${state.delayMinutes} MIN`,
        });
        // Simulate waiting out the delay.
        await sleep(simMinutesToMs(state.delayMinutes, msPerSimMinute));
    } else {
        state.status = "ON TIME";
        publish({
            id: route.id,
            status: "ON TIME",
            scheduledTime: route.scheduledTime,
            platform: state.platform,
        });
    }

    // Publish BOARDING as intent. Yield a tick so the main thread can receive
    // the BOARDING message, detect any platform conflict, and send a hold command
    // back before we commit to the boarding dwell. Without the yield, the hold
    // arrives after the dwell begins and is silently ignored.
    state.status = "BOARDING";
    publish({
        id: route.id,
        status: "BOARDING",
        scheduledTime: route.scheduledTime,
        platform: state.platform,
    });

    await new Promise<void>(resolve => setImmediate(resolve));

    // Now check whether dispatch placed a hold in response to BOARDING.
    if (state.held) {
        state.status = "HELD";
        publish({
            id: route.id,
            status: "HELD",
            scheduledTime: route.scheduledTime,
            platform: state.platform,
            remarks: "AWAITING PLT",
        });
        await waitForClear();
        // Platform may have been reassigned while held — republish BOARDING with
        // current platform so the board reflects the updated assignment.
        state.status = "BOARDING";
        publish({
            id: route.id,
            status: "BOARDING",
            scheduledTime: route.scheduledTime,
            platform: state.platform,
        });
    }

    // Boarding dwell — 3 simulated minutes at platform.
    const boardingDwellMs = simMinutesToMs(3, msPerSimMinute);
    await sleep(boardingDwellMs);

    // Depart.
    state.status = "DEPARTED";
    publish({
        id: route.id,
        status: "DEPARTED",
        scheduledTime: route.scheduledTime,
        platform: state.platform,
    });
};

// Run the journey. Worker exits naturally when this completes — the main
// thread handles recycling workers for the next timetable cycle.
await runJourney();
