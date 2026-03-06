// Pure helper functions extracted from train-worker.ts so they can be
// imported and tested independently without dragging in top-level await
// or live postal/transport imports.

/** Convert simulated minutes to real milliseconds. */
export const simMinutesToMs = (simMinutes: number, msPerSimMinute: number): number =>
    simMinutes * msPerSimMinute;

/** Random integer in [min, max] inclusive. */
export const randInt = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;
