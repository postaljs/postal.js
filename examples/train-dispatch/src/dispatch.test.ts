/* eslint-disable @typescript-eslint/no-explicit-any */
export default {};

import { findFreePlatform, createDispatchController } from "./dispatch.js";
import type { DispatchController } from "./dispatch.js";
import type { TrainStatusPayload } from "./types.js";

// --- Mock postal Channel ---
const mockPublish = jest.fn();
const mockSubscribe = jest.fn();
const mockChannel = {
    publish: mockPublish,
    subscribe: mockSubscribe,
} as any;

describe("dispatch", () => {
    describe("findFreePlatform", () => {
        describe("when all platforms are free", () => {
            let result: number | null;

            beforeEach(() => {
                result = findFreePlatform(new Map(), 3, 10);
            });

            it("should return platform 1 (the first free one, skipping excluded)", () => {
                // excludePlatform=3, so platform 1 is first available
                expect(result).toBe(1);
            });
        });

        describe("when only the excluded platform is occupied", () => {
            let result: number | null;

            beforeEach(() => {
                const occupied = new Map([[3, "1A42"]]);
                result = findFreePlatform(occupied, 3, 10);
            });

            it("should return the first non-excluded free platform", () => {
                expect(result).toBe(1);
            });
        });

        describe("when all platforms are occupied", () => {
            let result: number | null;

            beforeEach(() => {
                const occupied = new Map(
                    Array.from({ length: 10 }, (_, i) => [i + 1, `TRAIN-${i}`] as [number, string])
                );
                result = findFreePlatform(occupied, 1, 10);
            });

            it("should return null", () => {
                expect(result).toBeNull();
            });
        });

        describe("when some platforms are occupied but not all", () => {
            let result: number | null;

            beforeEach(() => {
                // Platforms 1-7 occupied, 8-10 free. Excluded: 3.
                const occupied = new Map(
                    Array.from({ length: 7 }, (_, i) => [i + 1, `TRAIN-${i}`] as [number, string])
                );
                result = findFreePlatform(occupied, 3, 10);
            });

            it("should return the first free non-excluded platform", () => {
                expect(result).toBe(8);
            });
        });
    });

    describe("createDispatchController", () => {
        let controller: DispatchController;
        let logMessages: string[];

        beforeEach(() => {
            jest.clearAllMocks();
            logMessages = [];
            controller = createDispatchController(mockChannel, msg => logMessages.push(msg));
        });

        describe("when a train publishes BOARDING on a free platform", () => {
            beforeEach(() => {
                const payload: TrainStatusPayload = {
                    id: "1A42",
                    status: "BOARDING",
                    scheduledTime: "06:45",
                    platform: 3,
                };
                controller.onTrainStatus(payload);
            });

            it("should claim the platform in the occupancy map", () => {
                expect(controller.getOccupancy().get(3)).toBe("1A42");
            });

            it("should not publish any hold command", () => {
                const holdCalls = mockPublish.mock.calls.filter(([topic]: [string]) =>
                    topic.includes(".hold")
                );
                expect(holdCalls).toHaveLength(0);
            });
        });

        describe("when a second train boards the same occupied platform", () => {
            beforeEach(() => {
                const firstTrain: TrainStatusPayload = {
                    id: "1A42",
                    status: "BOARDING",
                    scheduledTime: "06:45",
                    platform: 3,
                };
                const secondTrain: TrainStatusPayload = {
                    id: "2B17",
                    status: "BOARDING",
                    scheduledTime: "06:52",
                    platform: 3,
                };
                controller.onTrainStatus(firstTrain);
                controller.onTrainStatus(secondTrain);
            });

            it("should publish a platform reassignment for the second train", () => {
                const platformCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.2B17.platform"
                );
                expect(platformCalls).toHaveLength(1);
                expect(platformCalls[0][1]).toEqual({ platform: expect.any(Number) });
            });

            it("should publish a hold for the second train", () => {
                const holdCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.2B17.hold"
                );
                expect(holdCalls).toHaveLength(1);
            });

            it("should not hold or reassign the first train", () => {
                const firstHolds = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.1A42.hold"
                );
                expect(firstHolds).toHaveLength(0);
            });

            it("should publish a clear for the second train immediately after reassignment", () => {
                const clearCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.2B17.clear"
                );
                expect(clearCalls).toHaveLength(1);
            });

            it("should log a dispatch event", () => {
                const reassignLog = logMessages.find(m => m.includes("reassigned"));
                expect(reassignLog).toBeDefined();
            });
        });

        describe("when a train departs and frees its platform", () => {
            beforeEach(() => {
                controller.onTrainStatus({
                    id: "1A42",
                    status: "BOARDING",
                    scheduledTime: "06:45",
                    platform: 3,
                });
                controller.onTrainStatus({
                    id: "1A42",
                    status: "DEPARTED",
                    scheduledTime: "06:45",
                    platform: 3,
                });
            });

            it("should remove the platform from the occupancy map", () => {
                expect(controller.getOccupancy().has(3)).toBe(false);
            });

            it("should log a departed event", () => {
                const departLog = logMessages.find(m => m.includes("departed"));
                expect(departLog).toBeDefined();
            });
        });

        describe("when all platforms are full and a conflict occurs", () => {
            beforeEach(() => {
                // Fill all 10 platforms first.
                for (let p = 1; p <= 10; p++) {
                    controller.onTrainStatus({
                        id: `FILLER-${p}`,
                        status: "BOARDING",
                        scheduledTime: "06:00",
                        platform: p,
                    });
                }
                // Now try to board on platform 1 with a different train.
                controller.onTrainStatus({
                    id: "LATECOMER",
                    status: "BOARDING",
                    scheduledTime: "06:01",
                    platform: 1,
                });
            });

            it("should publish a hold without a platform reassignment", () => {
                const holdCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.LATECOMER.hold"
                );
                expect(holdCalls).toHaveLength(1);

                const platformCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.LATECOMER.platform"
                );
                expect(platformCalls).toHaveLength(0);
            });

            it("should log a no-alternatives event", () => {
                const noAltLog = logMessages.find(m => m.includes("no free platform"));
                expect(noAltLog).toBeDefined();
            });
        });

        describe("when all platforms are full, a train is held, and a platform frees via DEPARTED", () => {
            beforeEach(() => {
                // Fill all 10 platforms.
                for (let p = 1; p <= 10; p++) {
                    controller.onTrainStatus({
                        id: `FILLER-${p}`,
                        status: "BOARDING",
                        scheduledTime: "06:00",
                        platform: p,
                    });
                }
                // LATECOMER conflicts on platform 1 — no alternatives, so it's held.
                controller.onTrainStatus({
                    id: "LATECOMER",
                    status: "BOARDING",
                    scheduledTime: "06:01",
                    platform: 1,
                });
                jest.clearAllMocks();
                // Now FILLER-1 departs, freeing platform 1.
                controller.onTrainStatus({
                    id: "FILLER-1",
                    status: "DEPARTED",
                    scheduledTime: "06:00",
                    platform: 1,
                });
            });

            it("should publish a platform assignment to the held train", () => {
                const platformCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.LATECOMER.platform"
                );
                expect(platformCalls).toHaveLength(1);
                expect(platformCalls[0][1]).toEqual({ platform: 1 });
            });

            it("should publish a clear to the held train", () => {
                const clearCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.LATECOMER.clear"
                );
                expect(clearCalls).toHaveLength(1);
            });

            it("should log the clear event", () => {
                const clearLog = logMessages.find(
                    m => m.includes("LATECOMER") && m.includes("cleared")
                );
                expect(clearLog).toBeDefined();
            });
        });

        describe("when a train status transitions through SCHEDULED then BOARDING", () => {
            beforeEach(() => {
                controller.onTrainStatus({
                    id: "7G55",
                    status: "SCHEDULED",
                    scheduledTime: "07:38",
                    platform: 6,
                });
                controller.onTrainStatus({
                    id: "7G55",
                    status: "BOARDING",
                    scheduledTime: "07:38",
                    platform: 6,
                });
            });

            it("should claim the platform when boarding begins", () => {
                expect(controller.getOccupancy().get(6)).toBe("7G55");
            });
        });

        describe("when a held train re-boards on a platform that is now free", () => {
            // This exercises the onHold=true sub-branch inside the BOARDING else path.
            // The train was held (no alternatives), then departed trains freed a platform,
            // dispatch assigned it, and now the worker re-publishes BOARDING with the new platform.
            beforeEach(() => {
                // Fill all 10 platforms.
                for (let p = 1; p <= 10; p++) {
                    controller.onTrainStatus({
                        id: `BLOCKER-${p}`,
                        status: "BOARDING",
                        scheduledTime: "07:00",
                        platform: p,
                    });
                }
                // COMEBACK was held (no alternatives).
                controller.onTrainStatus({
                    id: "COMEBACK",
                    status: "BOARDING",
                    scheduledTime: "07:01",
                    platform: 1,
                });
                // Dispatch assigned COMEBACK platform 2 after BLOCKER-2 departed.
                controller.onTrainStatus({
                    id: "BLOCKER-2",
                    status: "DEPARTED",
                    scheduledTime: "07:00",
                    platform: 2,
                });
                jest.clearAllMocks();
                // Worker now re-publishes BOARDING with the assigned platform (2).
                controller.onTrainStatus({
                    id: "COMEBACK",
                    status: "BOARDING",
                    scheduledTime: "07:01",
                    platform: 2,
                });
            });

            it("should not publish a hold because the platform is now claimed by this train", () => {
                const holdCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.COMEBACK.hold"
                );
                expect(holdCalls).toHaveLength(0);
            });

            it("should not publish a clear because onHold was already reset by the departed handler", () => {
                const clearCalls = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.COMEBACK.clear"
                );
                expect(clearCalls).toHaveLength(0);
            });
        });

        describe("when a train's platform changes between status messages", () => {
            // This exercises the trainState.platform !== platform branch.
            beforeEach(() => {
                // Train first seen on platform 3.
                controller.onTrainStatus({
                    id: "SWITCHER",
                    status: "ON TIME",
                    scheduledTime: "08:00",
                    platform: 3,
                });
                // Worker accepted a platform reassignment and now reports platform 5.
                controller.onTrainStatus({
                    id: "SWITCHER",
                    status: "BOARDING",
                    scheduledTime: "08:00",
                    platform: 5,
                });
            });

            it("should track the updated platform in the occupancy map", () => {
                expect(controller.getOccupancy().get(5)).toBe("SWITCHER");
            });

            it("should not occupy the old platform", () => {
                expect(controller.getOccupancy().has(3)).toBe(false);
            });
        });

        describe("when a train departs a platform it does not own in the occupancy map", () => {
            // This exercises the occupancy.get(platform) !== id guard on DEPARTED,
            // ensuring we don't delete a platform owned by a different train.
            beforeEach(() => {
                // OWNER boards and claims platform 4.
                controller.onTrainStatus({
                    id: "OWNER",
                    status: "BOARDING",
                    scheduledTime: "08:00",
                    platform: 4,
                });
                // GHOST reports DEPARTED on platform 4 but never boarded — it doesn't own it.
                controller.onTrainStatus({
                    id: "GHOST",
                    status: "DEPARTED",
                    scheduledTime: "08:00",
                    platform: 4,
                });
            });

            it("should leave the platform assigned to its rightful owner", () => {
                expect(controller.getOccupancy().get(4)).toBe("OWNER");
            });

            it("should not log a departed event for the non-owner", () => {
                const departLog = logMessages.find(
                    m => m.includes("GHOST") && m.includes("departed")
                );
                expect(departLog).toBeUndefined();
            });
        });

        describe("when a train arrives (ARRIVED) and frees its platform", () => {
            // ARRIVED should free the platform the same as DEPARTED.
            beforeEach(() => {
                controller.onTrainStatus({
                    id: "FINISHER",
                    status: "BOARDING",
                    scheduledTime: "08:15",
                    platform: 7,
                });
                controller.onTrainStatus({
                    id: "FINISHER",
                    status: "ARRIVED",
                    scheduledTime: "08:15",
                    platform: 7,
                });
            });

            it("should remove the platform from occupancy on ARRIVED", () => {
                expect(controller.getOccupancy().has(7)).toBe(false);
            });
        });

        describe("when multiple trains are held and one platform frees up", () => {
            // The DEPARTED handler breaks after the first held train.
            // Only one held train should be unblocked per departure.
            beforeEach(() => {
                // Fill all 10 platforms.
                for (let p = 1; p <= 10; p++) {
                    controller.onTrainStatus({
                        id: `WALL-${p}`,
                        status: "BOARDING",
                        scheduledTime: "07:00",
                        platform: p,
                    });
                }
                // TWO trains conflict — both get held (no alternatives).
                controller.onTrainStatus({
                    id: "HELD-FIRST",
                    status: "BOARDING",
                    scheduledTime: "07:01",
                    platform: 1,
                });
                controller.onTrainStatus({
                    id: "HELD-SECOND",
                    status: "BOARDING",
                    scheduledTime: "07:02",
                    platform: 2,
                });
                jest.clearAllMocks();
                // One platform frees up.
                controller.onTrainStatus({
                    id: "WALL-3",
                    status: "DEPARTED",
                    scheduledTime: "07:00",
                    platform: 3,
                });
            });

            it("should publish a clear to exactly one held train", () => {
                const clearCalls = mockPublish.mock.calls.filter(([topic]: [string]) =>
                    (topic as string).endsWith(".clear")
                );
                expect(clearCalls).toHaveLength(1);
            });

            it("should not clear the second held train", () => {
                const secondClear = mockPublish.mock.calls.filter(
                    ([topic]: [string]) => topic === "dispatch.HELD-SECOND.clear"
                );
                expect(secondClear).toHaveLength(0);
            });
        });

        describe("when a train sends a non-BOARDING non-DEPARTED status (no-op path)", () => {
            // Statuses like SCHEDULED, ON TIME, DELAYED do not trigger occupancy changes.
            beforeEach(() => {
                controller.onTrainStatus({
                    id: "DAWDLER",
                    status: "DELAYED",
                    scheduledTime: "09:00",
                    platform: 9,
                });
            });

            it("should not claim the platform in occupancy", () => {
                expect(controller.getOccupancy().has(9)).toBe(false);
            });

            it("should not publish any dispatch commands", () => {
                expect(mockPublish).not.toHaveBeenCalled();
            });
        });

        describe("when platformCount is 1 and the only platform is occupied", () => {
            let result: number | null;

            beforeEach(() => {
                const occupied = new Map([[1, "SOLO"]]);
                result = findFreePlatform(occupied, 1, 1);
            });

            it("should return null — no alternatives exist", () => {
                expect(result).toBeNull();
            });
        });
    });

    describe("findFreePlatform — additional boundary cases", () => {
        describe("when excluded platform is platform 1 and platform 2 is the only free one", () => {
            let result: number | null;

            beforeEach(() => {
                // Platforms 1 occupied (excluded), platforms 3-10 occupied, only 2 is free.
                const occupied = new Map<number, string>([
                    [1, "TRAIN-A"],
                    [3, "TRAIN-C"],
                    [4, "TRAIN-D"],
                    [5, "TRAIN-E"],
                    [6, "TRAIN-F"],
                    [7, "TRAIN-G"],
                    [8, "TRAIN-H"],
                    [9, "TRAIN-I"],
                    [10, "TRAIN-J"],
                ]);
                result = findFreePlatform(occupied, 1, 10);
            });

            it("should return platform 2", () => {
                expect(result).toBe(2);
            });
        });
    });
});
