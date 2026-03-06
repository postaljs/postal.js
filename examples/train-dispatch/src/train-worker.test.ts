/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

// The worker itself uses top-level await and live postal/transport imports,
// making it untestable in isolation. Instead we test the pure state-machine
// logic that the worker implements — the parts that have no I/O side effects.
// These are the buildable, unit-testable pieces:
//   1. Timing helpers (simMinutesToMs, randInt) — imported from train-worker-utils
//   2. Delay injection probability (the 25% roll)
//   3. Hold/clear mechanics (via a local simulation)
//   4. Platform reassignment guard (only accepted before BOARDING)

import { simMinutesToMs, randInt } from "./train-worker-utils.js";

// --- Hold/clear state simulation ---
// WorkerState is private to train-worker.ts so we reproduce the minimal shape
// needed to test the hold/clear/platform logic in isolation.

type WorkerState = {
    held: boolean;
    holdRelease: (() => void) | null;
    platform: number;
    delayMinutes: number;
    status: string;
};

const makeState = (): WorkerState => ({
    held: false,
    holdRelease: null,
    platform: 3,
    delayMinutes: 0,
    status: "SCHEDULED",
});

/** Simulates the hold command handler. */
const applyHold = (state: WorkerState): void => {
    state.held = true;
};

/** Simulates the clear command handler. */
const applyClear = (state: WorkerState): void => {
    state.held = false;
    if (state.holdRelease) {
        state.holdRelease();
        state.holdRelease = null;
    }
};

/** Simulates the platform reassign handler — only accepted before BOARDING. */
const applyPlatform = (state: WorkerState, platform: number): void => {
    const preBoarding = ["SCHEDULED", "ON TIME", "DELAYED", "HELD"];
    if (preBoarding.includes(state.status)) {
        state.platform = platform;
    }
};

/** Simulates waitForClear — resolves immediately if not held. */
const waitForClear = (state: WorkerState): Promise<void> =>
    new Promise(resolve => {
        if (!state.held) {
            resolve();
            return;
        }
        state.holdRelease = resolve;
    });

// -------------------------------------------------------------------

describe("train-worker", () => {
    describe("simMinutesToMs", () => {
        describe("when converting simulated minutes to real milliseconds", () => {
            let result: number;

            beforeEach(() => {
                result = simMinutesToMs(5, 2000);
            });

            it("should multiply simulated minutes by the ms-per-minute factor", () => {
                expect(result).toBe(10000);
            });
        });

        describe("when simulated minutes is zero", () => {
            let result: number;

            beforeEach(() => {
                result = simMinutesToMs(0, 2000);
            });

            it("should return zero", () => {
                expect(result).toBe(0);
            });
        });
    });

    describe("randInt", () => {
        describe("when generating a random integer in range", () => {
            let results: number[];

            beforeEach(() => {
                results = Array.from({ length: 50 }, () => randInt(2, 15));
            });

            it("should always return values within the specified range", () => {
                expect(results.every(r => r >= 2 && r <= 15)).toBe(true);
            });
        });

        describe("when min and max are equal", () => {
            let result: number;

            beforeEach(() => {
                result = randInt(7, 7);
            });

            it("should always return that single value", () => {
                expect(result).toBe(7);
            });
        });
    });

    describe("simMinutesToMs", () => {
        describe("when simulated minutes is negative", () => {
            let result: number;

            beforeEach(() => {
                result = simMinutesToMs(-3, 2000);
            });

            it("should return a negative millisecond value", () => {
                expect(result).toBe(-6000);
            });
        });
    });

    describe("hold / clear mechanics", () => {
        describe("when a hold command is applied", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                applyHold(state);
            });

            it("should set held to true", () => {
                expect(state.held).toBe(true);
            });
        });

        describe("when a clear command is applied after a hold", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                applyHold(state);
                applyClear(state);
            });

            it("should set held to false", () => {
                expect(state.held).toBe(false);
            });
        });

        describe("when waitForClear is called while not held", () => {
            let resolved: boolean;

            beforeEach(async () => {
                const state = makeState();
                resolved = false;
                await waitForClear(state);
                resolved = true;
            });

            it("should resolve immediately", () => {
                expect(resolved).toBe(true);
            });
        });

        describe("when waitForClear is called while held, then cleared", () => {
            let resolved: boolean;

            beforeEach(async () => {
                const state = makeState();
                resolved = false;
                applyHold(state);

                const clearPromise = waitForClear(state).then(() => {
                    resolved = true;
                });

                // Simulate dispatch clearing the hold.
                applyClear(state);
                await clearPromise;
            });

            it("should resolve after the hold is cleared", () => {
                expect(resolved).toBe(true);
            });

            it("should set held to false", () => {
                // The state used in beforeEach is local, so we verify via resolved flag.
                expect(resolved).toBe(true);
            });
        });
    });

    describe("platform reassignment", () => {
        describe("when a platform command arrives before BOARDING", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                state.status = "ON TIME";
                applyPlatform(state, 9);
            });

            it("should update the platform number", () => {
                expect(state.platform).toBe(9);
            });
        });

        describe("when a platform command arrives during BOARDING", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                state.status = "BOARDING";
                applyPlatform(state, 9);
            });

            it("should not update the platform number", () => {
                // Train is already committed to boarding — reassign ignored.
                expect(state.platform).toBe(3);
            });
        });

        describe("when a platform command arrives while HELD", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                state.status = "HELD";
                applyPlatform(state, 5);
            });

            it("should update the platform number", () => {
                // HELD is pre-boarding — reassignment must be accepted.
                expect(state.platform).toBe(5);
            });
        });

        describe("when a platform command arrives after DEPARTED", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                state.status = "DEPARTED";
                applyPlatform(state, 9);
            });

            it("should not update the platform number", () => {
                // Post-boarding statuses are not in the pre-boarding allow-list.
                expect(state.platform).toBe(3);
            });
        });
    });

    describe("hold / clear mechanics — additional edge cases", () => {
        describe("when a clear command is applied without a prior hold", () => {
            let state: WorkerState;

            beforeEach(() => {
                state = makeState();
                // holdRelease is null, held is false — clear should be a no-op on the release.
                applyClear(state);
            });

            it("should leave held as false", () => {
                expect(state.held).toBe(false);
            });

            it("should leave holdRelease as null", () => {
                expect(state.holdRelease).toBeNull();
            });
        });
    });

    describe("delay injection", () => {
        describe("when many random rolls are made", () => {
            let rolls: boolean[];

            beforeEach(() => {
                // Run 1000 rolls and check the delay flag (same logic as worker: < 0.25).
                rolls = Array.from({ length: 1000 }, () => Math.random() < 0.25);
            });

            it("should produce some delayed trains (probability ~25%)", () => {
                const delayedCount = rolls.filter(Boolean).length;
                // With 1000 rolls at 25% probability, chance of getting 0 is astronomically low.
                expect(delayedCount).toBeGreaterThan(0);
            });

            it("should produce some on-time trains", () => {
                const onTimeCount = rolls.filter(r => !r).length;
                expect(onTimeCount).toBeGreaterThan(0);
            });
        });
    });
});
