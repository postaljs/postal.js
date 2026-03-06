// Dispatch controller — platform conflict detection and resolution.
//
// Monitors incoming train status messages. If two trains would occupy
// the same platform at the same time (both in BOARDING or not yet DEPARTED),
// it holds the later-boarding train and optionally reassigns it to a free
// platform. When a platform frees up it publishes a clear command.
//
// Platform occupancy is tracked in a simple map: platform → trainId.
// A platform is "occupied" from BOARDING until DEPARTED.

import type { Channel } from "postal";
import type { TrainStatusPayload, HoldPayload, PlatformPayload } from "./types.js";
import { PLATFORM_COUNT } from "./schedule.js";

/** Platforms that are currently occupied: platformNumber → trainId. */
type PlatformRegistry = Map<number, string>;

/** Per-train state the dispatch controller tracks. */
type TrainDispatchState = {
    id: string;
    platform: number;
    status: string;
    /** Whether this train is currently under a hold order. */
    onHold: boolean;
};

export type DispatchController = {
    /** Process an incoming train status update. */
    onTrainStatus: (payload: TrainStatusPayload) => void;
    /** Returns the current occupancy map (read-only). */
    getOccupancy: () => ReadonlyMap<number, string>;
};

/**
 * Finds a free platform not in the occupied set and not the excluded platform.
 * Returns null if no platform is available.
 */
export const findFreePlatform = (
    occupied: ReadonlyMap<number, string>,
    excludePlatform: number,
    platformCount: number
): number | null => {
    for (let p = 1; p <= platformCount; p++) {
        if (p !== excludePlatform && !occupied.has(p)) {
            return p;
        }
    }
    return null;
};

/**
 * Creates a dispatch controller.
 *
 * @param channel - The postal channel to publish dispatch commands on.
 * @param onDispatchEvent - Called whenever a dispatch action is taken (for logging).
 */
export const createDispatchController = (
    // Dispatch uses dynamic template literal topics — a typed channel adds no safety here.
    // `any` sidesteps the variance mismatch between Channel<TMap> and Channel<Record<string, unknown>>.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel: Channel<any>,
    onDispatchEvent: (message: string) => void
): DispatchController => {
    const occupancy: PlatformRegistry = new Map();
    const trains = new Map<string, TrainDispatchState>();

    const publishHold = (id: string, reason: string): void => {
        const payload: HoldPayload = { reason };
        channel.publish(`dispatch.${id}.hold`, payload);
    };

    const publishClear = (id: string): void => {
        channel.publish(`dispatch.${id}.clear`, {});
    };

    const publishPlatform = (id: string, platform: number): void => {
        const payload: PlatformPayload = { platform };
        channel.publish(`dispatch.${id}.platform`, payload);
    };

    const onTrainStatus = (payload: TrainStatusPayload): void => {
        const { id, status, platform } = payload;

        // Update or create tracking state for this train.
        const existing = trains.get(id);
        const trainState: TrainDispatchState = existing ?? {
            id,
            platform,
            status,
            onHold: false,
        };
        trainState.status = status;

        // If the platform changed (e.g., worker accepted a reassign), update tracking.
        if (trainState.platform !== platform) {
            // Release old platform if we were occupying it.
            if (occupancy.get(trainState.platform) === id) {
                occupancy.delete(trainState.platform);
            }
            trainState.platform = platform;
        }

        trains.set(id, trainState);

        if (status === "BOARDING") {
            // Check if another train already occupies this platform.
            const current = occupancy.get(platform);

            if (current && current !== id) {
                // Conflict — find an alternative platform.
                const alt = findFreePlatform(occupancy, platform, PLATFORM_COUNT);
                if (alt !== null) {
                    // Reassign to the free platform, hold briefly, then immediately
                    // clear. The hold is just a yield so the worker can absorb the
                    // platform reassignment before it commits to the boarding dwell.
                    publishPlatform(id, alt);
                    publishHold(id, `Platform ${platform} occupied by ${current}`);
                    trainState.platform = alt;
                    occupancy.set(alt, id);
                    onDispatchEvent(`${id} reassigned: platform ${platform} → ${alt}`);
                    // Alt platform is already claimed — clear the train immediately.
                    publishClear(id);
                    trainState.onHold = false;
                    onDispatchEvent(`${id} cleared: reassigned to platform ${alt}`);
                } else {
                    // No alternatives — hold the train until a platform frees up.
                    // The DEPARTED handler below will pick this up and issue the clear.
                    publishHold(id, `Platform ${platform} occupied, no alternatives`);
                    trainState.onHold = true;
                    onDispatchEvent(`${id} held: platform ${platform} conflict, no free platform`);
                }
            } else {
                // Platform is free — claim it.
                occupancy.set(platform, id);
                if (trainState.onHold) {
                    // Train was held and platform is now free — clear it.
                    publishClear(id);
                    trainState.onHold = false;
                    onDispatchEvent(`${id} cleared: platform ${platform} now available`);
                }
            }
        } else if (status === "DEPARTED" || status === "ARRIVED") {
            // Free the platform.
            if (occupancy.get(platform) === id) {
                occupancy.delete(platform);
                onDispatchEvent(`${id} departed platform ${platform}`);
            }

            // Check if any tracked train is held waiting for a platform. Now that
            // one has freed up, we can assign the freed platform and clear the hold.
            // Only the first held train is unblocked — if multiple trains are held
            // they'll each get cleared as further platforms free up.
            for (const [heldId, heldState] of trains) {
                if (heldState.onHold) {
                    heldState.platform = platform;
                    occupancy.set(platform, heldId);
                    publishPlatform(heldId, platform);
                    publishClear(heldId);
                    heldState.onHold = false;
                    onDispatchEvent(`${heldId} cleared: assigned freed platform ${platform}`);
                    break;
                }
            }
        }
    };

    const getOccupancy = (): ReadonlyMap<number, string> => occupancy;

    return { onTrainStatus, getOccupancy };
};
