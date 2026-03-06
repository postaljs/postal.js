import type { RouteDefinition } from "./types.js";

// Sim runs at ~30x speed: 1 real second = 0.5 simulated minutes.
// So boarding windows are in simulated minutes from sim-start (06:40).
// Each train boards ~1–2 sim minutes after the previous departure.
//
// The schedule recycles: when a train departs, a new departure for the same
// destination is generated with a later time and a fresh ID.

export const SIM_START_DISPLAY_TIME = "06:40";

/** How many real milliseconds represent one simulated minute. */
export const MS_PER_SIM_MINUTE = 2000; // 2 real seconds = 1 simulated minute

/** Platform count — used by dispatch to find alternatives. */
export const PLATFORM_COUNT = 10;

/**
 * The 8 trains that cycle through the board.
 * boardingAtMinute is relative to sim-start (06:40 in display time).
 * Platform is initial assignment — dispatch may reassign.
 */
export const TRAIN_SCHEDULE: RouteDefinition[] = [
    {
        id: "1A42",
        destination: "MANCHESTER",
        scheduledTime: "06:45",
        boardingAtMinute: 5,
        platform: 3,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Birmingham", minutesFromDeparture: 12 },
            { name: "Manchester", minutesFromDeparture: 25 },
        ],
    },
    {
        id: "2B17",
        destination: "EDINBURGH",
        scheduledTime: "06:52",
        boardingAtMinute: 12,
        platform: 7,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "York", minutesFromDeparture: 15 },
            { name: "Edinburgh", minutesFromDeparture: 30 },
        ],
    },
    {
        id: "3C09",
        destination: "BIRMINGHAM",
        scheduledTime: "07:01",
        boardingAtMinute: 21,
        platform: 1,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Birmingham", minutesFromDeparture: 18 },
        ],
    },
    {
        id: "4D21",
        destination: "LIVERPOOL",
        scheduledTime: "07:15",
        boardingAtMinute: 35,
        platform: 5,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Crewe", minutesFromDeparture: 14 },
            { name: "Liverpool", minutesFromDeparture: 25 },
        ],
    },
    {
        id: "5E33",
        destination: "BRISTOL",
        scheduledTime: "07:22",
        boardingAtMinute: 42,
        platform: 2,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Reading", minutesFromDeparture: 10 },
            { name: "Bristol", minutesFromDeparture: 22 },
        ],
    },
    {
        id: "6F48",
        destination: "GLASGOW",
        scheduledTime: "07:30",
        boardingAtMinute: 50,
        platform: 4,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Preston", minutesFromDeparture: 18 },
            { name: "Glasgow", minutesFromDeparture: 35 },
        ],
    },
    {
        id: "7G55",
        destination: "CARDIFF",
        scheduledTime: "07:38",
        boardingAtMinute: 58,
        platform: 6,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Swindon", minutesFromDeparture: 12 },
            { name: "Cardiff", minutesFromDeparture: 24 },
        ],
    },
    {
        id: "8H62",
        destination: "YORK",
        scheduledTime: "07:45",
        boardingAtMinute: 65,
        platform: 8,
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Peterborough", minutesFromDeparture: 13 },
            { name: "York", minutesFromDeparture: 26 },
        ],
    },
];

// --- Departure recycling ---

/** Pool of UK destinations for recycled departures. Shuffled each pass. */
const DESTINATION_POOL: Array<{ destination: string; route: RouteDefinition["route"] }> = [
    {
        destination: "MANCHESTER",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Birmingham", minutesFromDeparture: 12 },
            { name: "Manchester", minutesFromDeparture: 25 },
        ],
    },
    {
        destination: "EDINBURGH",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "York", minutesFromDeparture: 15 },
            { name: "Edinburgh", minutesFromDeparture: 30 },
        ],
    },
    {
        destination: "BIRMINGHAM",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Birmingham", minutesFromDeparture: 18 },
        ],
    },
    {
        destination: "LIVERPOOL",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Crewe", minutesFromDeparture: 14 },
            { name: "Liverpool", minutesFromDeparture: 25 },
        ],
    },
    {
        destination: "BRISTOL",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Reading", minutesFromDeparture: 10 },
            { name: "Bristol", minutesFromDeparture: 22 },
        ],
    },
    {
        destination: "GLASGOW",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Preston", minutesFromDeparture: 18 },
            { name: "Glasgow", minutesFromDeparture: 35 },
        ],
    },
    {
        destination: "CARDIFF",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Swindon", minutesFromDeparture: 12 },
            { name: "Cardiff", minutesFromDeparture: 24 },
        ],
    },
    {
        destination: "YORK",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Peterborough", minutesFromDeparture: 13 },
            { name: "York", minutesFromDeparture: 26 },
        ],
    },
    {
        destination: "NEWCASTLE",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Darlington", minutesFromDeparture: 20 },
            { name: "Newcastle", minutesFromDeparture: 28 },
        ],
    },
    {
        destination: "LEEDS",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Wakefield", minutesFromDeparture: 16 },
            { name: "Leeds", minutesFromDeparture: 20 },
        ],
    },
    {
        destination: "NOTTINGHAM",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Leicester", minutesFromDeparture: 11 },
            { name: "Nottingham", minutesFromDeparture: 19 },
        ],
    },
    {
        destination: "SHEFFIELD",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Derby", minutesFromDeparture: 14 },
            { name: "Sheffield", minutesFromDeparture: 22 },
        ],
    },
    {
        destination: "EXETER",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Taunton", minutesFromDeparture: 15 },
            { name: "Exeter", minutesFromDeparture: 24 },
        ],
    },
    {
        destination: "CAMBRIDGE",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Cambridge", minutesFromDeparture: 14 },
        ],
    },
    {
        destination: "OXFORD",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Oxford", minutesFromDeparture: 12 },
        ],
    },
    {
        destination: "BATH",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Reading", minutesFromDeparture: 10 },
            { name: "Bath", minutesFromDeparture: 20 },
        ],
    },
    {
        destination: "NORWICH",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Ipswich", minutesFromDeparture: 13 },
            { name: "Norwich", minutesFromDeparture: 22 },
        ],
    },
    {
        destination: "PLYMOUTH",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Exeter", minutesFromDeparture: 24 },
            { name: "Plymouth", minutesFromDeparture: 35 },
        ],
    },
    {
        destination: "SOUTHAMPTON",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Winchester", minutesFromDeparture: 10 },
            { name: "Southampton", minutesFromDeparture: 16 },
        ],
    },
    {
        destination: "BRIGHTON",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Brighton", minutesFromDeparture: 11 },
        ],
    },
    {
        destination: "ABERDEEN",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Edinburgh", minutesFromDeparture: 30 },
            { name: "Aberdeen", minutesFromDeparture: 45 },
        ],
    },
    {
        destination: "INVERNESS",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Perth", minutesFromDeparture: 35 },
            { name: "Inverness", minutesFromDeparture: 50 },
        ],
    },
    {
        destination: "SWANSEA",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Cardiff", minutesFromDeparture: 24 },
            { name: "Swansea", minutesFromDeparture: 32 },
        ],
    },
    {
        destination: "PETERBOROUGH",
        route: [
            { name: "London", minutesFromDeparture: 0 },
            { name: "Peterborough", minutesFromDeparture: 13 },
        ],
    },
];

/** Fisher-Yates shuffle (in place). Or Knuth shuffle, for the purists. :-D */
const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/** Generates sequential departures from a shuffled pool of UK destinations. */
export const createDepartureQueue = (): { next: (boardingAtMinute: number) => RouteDefinition } => {
    let idCounter = 9; // Start after the 8 initial trains
    let poolIndex = 0;
    let shuffled = shuffle([...DESTINATION_POOL]);

    const next = (boardingAtMinute: number): RouteDefinition => {
        if (poolIndex >= shuffled.length) {
            shuffled = shuffle([...DESTINATION_POOL]);
            poolIndex = 0;
        }

        const entry = shuffled[poolIndex++];
        idCounter++;

        // Generate a plausible UK-style train ID: digit + letter + two digits.
        // The letter cycles through A–Z, the prefix digit advances every 26
        // trains, and the suffix wraps at 99 — purely cosmetic, not meaningful.
        const letter = String.fromCodePoint(65 + (idCounter % 26));
        const num = String(idCounter).padStart(2, "0").slice(-2);
        const prefix = String(Math.floor(idCounter / 26) % 10);
        const newId = `${prefix}${letter}${num}`;

        // Compute display time from boardingAtMinute. Subtract 3 to show the
        // scheduled departure ~3 sim-minutes before boarding opens, matching
        // the pattern of the initial TRAIN_SCHEDULE entries.
        const totalMinutes = 6 * 60 + 40 + boardingAtMinute - 3;
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        const scheduledTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

        // Pick a platform from the pool (1-10), varying by idCounter
        const platform = (idCounter % PLATFORM_COUNT) + 1;

        return {
            id: newId,
            destination: entry.destination,
            route: entry.route,
            scheduledTime,
            boardingAtMinute,
            platform,
        };
    };

    return { next };
};
