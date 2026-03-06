// Shared types for the train dispatch board.
// Workers and main thread both import from here — keep it free of any
// Node.js or postal imports so it's safe to import anywhere.
//
// The ChannelRegistry augmentation below tells postal what payload types
// flow on each topic of the "train-dispatch" channel. This is a compile-time-only
// ambient declaration — no runtime import is introduced. Once declared,
// getChannel("train-dispatch") returns a fully typed Channel and subscribe/publish
// infer payload types automatically instead of falling back to `unknown`.
// Template literal index signatures (e.g. `train.${string}.status`) let
// PayloadFor resolve wildcard patterns like "train.#" to the correct union.

/** All possible states a train can be in on the board. */
export type TrainStatus =
    | "SCHEDULED"
    | "ON TIME"
    | "DELAYED"
    | "BOARDING"
    | "DEPARTED"
    | "HELD"
    | "EXPECTED"
    | "ARRIVED";

/** Intermediate stations a train passes through on its route. */
export type RouteStation = {
    name: string;
    /** Minutes from departure the train arrives at this station. */
    minutesFromDeparture: number;
};

/** Static definition of a train's route — passed to workers via workerData. */
export type RouteDefinition = {
    id: string;
    destination: string;
    route: RouteStation[];
    /** Scheduled departure time as "HH:MM" — used for display only. */
    scheduledTime: string;
    /** Simulated minutes from sim-start when this train should start boarding. */
    boardingAtMinute: number;
    platform: number;
};

/** Payload for train.<id>.status messages published by workers. */
export type TrainStatusPayload = {
    id: string;
    status: TrainStatus;
    scheduledTime: string;
    platform: number;
    /** Delay in minutes, if any. */
    delay?: number;
    remarks?: string;
};

/** Payload for train.<id>.position messages published by workers. */
export type TrainPositionPayload = {
    id: string;
    currentStation: string;
    nextStation: string;
    /** 0–100 percentage of the current leg. */
    progress: number;
    delay: number;
};

/** Payload for dispatch.<id>.hold messages published by main. */
export type HoldPayload = {
    reason: string;
};

/** Payload for dispatch.<id>.platform messages published by main. */
export type PlatformPayload = {
    platform: number;
};

/** Payload for dispatch.<id>.clear messages published by main (empty). */
export type ClearPayload = Record<string, never>;

/** The full state the main thread tracks for each train row on the board. */
export type TrainRowState = {
    id: string;
    destination: string;
    scheduledTime: string;
    platform: number;
    status: TrainStatus;
    remarks: string;
};

/** A single line in the dispatch log. */
export type DispatchLogEntry = {
    /** Wall-clock timestamp string, e.g. "06:41:02" */
    timestamp: string;
    message: string;
};

/** Worker initialisation data passed via workerData. */
export type WorkerInitData = {
    route: RouteDefinition;
    /** Simulated time start (Date.now() equivalent in the sim). */
    simStartMs: number;
    /** How many real ms = 1 simulated minute. */
    msPerSimMinute: number;
};

// --- Channel registry augmentation ---

declare module "postal" {
    interface ChannelRegistry {
        "train-dispatch": {
            [key: `train.${string}.status`]: TrainStatusPayload;
            [key: `train.${string}.position`]: TrainPositionPayload;
            [key: `dispatch.${string}.hold`]: HoldPayload;
            [key: `dispatch.${string}.clear`]: ClearPayload;
            [key: `dispatch.${string}.platform`]: PlatformPayload;
        };
    }
}
