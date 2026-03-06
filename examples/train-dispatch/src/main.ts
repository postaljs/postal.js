// Main entry point — orchestrates the train departure board demo.
//
// Responsibilities:
//   1. Enter alternate screen buffer
//   2. Spawn 8 train workers (one per route), connect them via MessagePort transport
//   3. Subscribe to train.# to update the display and feed the dispatch controller
//   4. Run a render loop at ~30fps
//   5. Update simulated clock in the header
//   6. Handle SIGINT/SIGTERM and 'q' keypress for clean shutdown
//
// Wiretap feeds the dispatch log — we deliberately show *everything* on the bus.

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getChannel, addTransport, addWiretap } from "postal";
import { connectToWorkerThread } from "postal-transport-messageport/node";
import { createDisplay } from "./display.js";
import { createDispatchController } from "./dispatch.js";
import {
    TRAIN_SCHEDULE,
    MS_PER_SIM_MINUTE,
    SIM_START_DISPLAY_TIME,
    createDepartureQueue,
} from "./schedule.js";
// Importing from types.js also activates the ChannelRegistry augmentation,
// so getChannel("train-dispatch") returns a fully typed channel automatically.
import type {
    TrainStatusPayload,
    TrainRowState,
    WorkerInitData,
    RouteDefinition,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, "train-worker.ts");

// Sim clock: 06:40 in display time, advancing at 1 sim-minute per MS_PER_SIM_MINUTE real ms.
const SIM_HOUR_START = 6;
const SIM_MINUTE_START = 40;

/** Returns the current simulated time as "HH:MM:SS". */
const getSimTime = (simStartMs: number): string => {
    const elapsedRealMs = Date.now() - simStartMs;
    const elapsedSimSeconds = Math.floor(elapsedRealMs / (MS_PER_SIM_MINUTE / 60));
    const totalSimSeconds = SIM_HOUR_START * 3600 + SIM_MINUTE_START * 60 + elapsedSimSeconds;
    const h = Math.floor(totalSimSeconds / 3600) % 24;
    const m = Math.floor((totalSimSeconds % 3600) / 60);
    const s = totalSimSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Formats a wall-clock timestamp as "HH:MM:SS". */
const wallClock = (): string => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
};

const main = async (): Promise<void> => {
    const display = createDisplay();
    display.enter();

    const simStartMs = Date.now();
    const channel = getChannel("train-dispatch");

    // Track board row assignments: trainId → rowIndex
    const rowAssignments = new Map<string, number>();

    // Initialise display rows with "EXPECTED" placeholders.
    TRAIN_SCHEDULE.forEach((route, i) => {
        rowAssignments.set(route.id, i);
        const initialRow: TrainRowState = {
            id: route.id,
            destination: route.destination,
            scheduledTime: route.scheduledTime,
            platform: route.platform,
            status: "EXPECTED",
            remarks: "",
        };
        display.updateTrain(i, initialRow);
    });

    // Dispatch controller gets status updates and manages platform conflicts.
    const dispatch = createDispatchController(channel, message => {
        display.addLogEntry({ timestamp: wallClock(), message });
    });

    // Wiretap feeds the dispatch log with every envelope that flows through the bus.
    // This is the deliberate observability showcase — don't filter it.
    addWiretap(envelope => {
        const msg = `${envelope.topic.padEnd(30)} ${JSON.stringify(envelope.payload ?? "").slice(0, 40)}`;
        display.addLogEntry({ timestamp: wallClock(), message: msg });
    });

    // Subscribe to all train messages using the # wildcard so we don't miss
    // any topic. We only forward status envelopes to the dispatch controller
    // because position envelopes carry a different payload shape (no `platform`
    // field) and would cause the conflict-detection logic to behave incorrectly.
    channel.subscribe("train.#", envelope => {
        if (!envelope.topic.endsWith(".status")) {
            return;
        }

        // The wildcard resolves to TrainStatusPayload | TrainPositionPayload.
        // The topic guard above ensures we only reach here for .status envelopes.
        const payload: TrainStatusPayload = envelope.payload as TrainStatusPayload;
        if (!payload?.id) {
            return;
        }

        const rowIndex = rowAssignments.get(payload.id);
        if (rowIndex === undefined) {
            return;
        }

        const remarks = payload.remarks ?? "";

        const row: TrainRowState = {
            id: payload.id,
            destination: TRAIN_SCHEDULE.find(r => r.id === payload.id)?.destination ?? payload.id,
            scheduledTime: payload.scheduledTime,
            platform: payload.platform,
            status: payload.status,
            remarks,
        };
        display.updateTrain(rowIndex, row);

        // Feed dispatch controller so it can detect platform conflicts.
        dispatch.onTrainStatus(payload);

        // When a train departs, recycle the row with a new departure after a
        // short delay (gives the departure animation time to play out, then
        // triggers the full-row split-flap cascade for the incoming train).
        if (payload.status === "DEPARTED") {
            const departedRowIndex = rowIndex;
            setTimeout(() => {
                const newRoute = departureQueue.next(nextBoardingMinute);
                nextBoardingMinute += 10;

                display.updateTrain(departedRowIndex, {
                    id: newRoute.id,
                    destination: newRoute.destination,
                    scheduledTime: newRoute.scheduledTime,
                    platform: newRoute.platform,
                    status: "EXPECTED",
                    remarks: "",
                });

                spawnWorker(newRoute, departedRowIndex);
            }, MS_PER_SIM_MINUTE * 2);
        }
    });

    // --- Worker management ---
    const workers: Worker[] = [];
    const departureQueue = createDepartureQueue();

    // Track the next boardingAtMinute for recycled departures.
    // Start after the last initial train's boarding time.
    let nextBoardingMinute = TRAIN_SCHEDULE.at(-1)!.boardingAtMinute + 10;

    /** Spawn a worker for a route and assign it to a board row. */
    const spawnWorker = async (route: RouteDefinition, rowIndex: number): Promise<void> => {
        rowAssignments.set(route.id, rowIndex);

        const workerInitData: WorkerInitData = {
            route,
            simStartMs,
            msPerSimMinute: MS_PER_SIM_MINUTE,
        };

        const worker = new Worker(WORKER_PATH, {
            workerData: workerInitData,
            // Forward execArgv so the worker inherits the tsx loader that the
            // main process was started with — without this the worker can't
            // import TypeScript source files directly.
            execArgv: process.execArgv,
        });
        workers.push(worker);

        try {
            const transport = await connectToWorkerThread(worker);
            addTransport(transport);
        } catch (err) {
            display.addLogEntry({
                timestamp: wallClock(),
                message: `Worker ${route.id} transport failed: ${String(err)}`,
            });
        }

        worker.on("error", err => {
            display.addLogEntry({
                timestamp: wallClock(),
                message: `Worker ${route.id} error: ${err.message}`,
            });
        });
    };

    // Spawn initial workers.
    for (let i = 0; i < TRAIN_SCHEDULE.length; i++) {
        await spawnWorker(TRAIN_SCHEDULE[i], i);
    }

    // Render loop at ~30fps.
    const RENDER_INTERVAL_MS = 33;
    const renderInterval = setInterval(() => {
        display.setSimTime(getSimTime(simStartMs));
        display.render();
    }, RENDER_INTERVAL_MS);

    // --- Cleanup ---

    const shutdown = (): void => {
        clearInterval(renderInterval);
        for (const w of workers) {
            w.terminate();
        }
        display.exit();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Handle raw keypress for 'q' quit.
    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (key: string) => {
            if (key === "q" || key === "\u0003") {
                shutdown();
            }
        });
    }

    // Initial render before workers start reporting.
    display.setSimTime(getSimTime(simStartMs));
    display.render();

    display.addLogEntry({
        timestamp: wallClock(),
        message: `Postal Central Station open — ${SIM_START_DISPLAY_TIME} (press q to quit)`,
    });
};

main().catch(err => {
    process.stderr.write(`Fatal: ${String(err)}\n`);
    process.exit(1);
});
