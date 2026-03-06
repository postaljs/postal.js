// Terminal departure board display.
//
// Owns all stdout output — composites the entire frame into one string and
// calls process.stdout.write() once per render cycle to avoid flicker.
//
// Layout coordinates are 1-indexed row/col in terminal space. All cells
// are split-flap animated: when a value changes the characters cycle before
// landing on the new value.

import {
    moveTo,
    amber,
    amberDim,
    amberBright,
    white,
    green,
    red,
    cyan,
    gray,
    blue,
    bold,
    hideCursor,
    showCursor,
    enterAltScreen,
    exitAltScreen,
    clearScreen,
    BOX,
} from "./ansi.js";
import { createSplitFlapAnimation, type SplitFlapAnimation } from "./split-flap.js";
import type { TrainRowState, DispatchLogEntry } from "./types.js";

// --- Layout constants ---

const BOARD_COL_START = 2;

// Column widths (visible character count, excluding borders)
const COL_WIDTHS = {
    num: 3,
    destination: 13,
    time: 7,
    platform: 6,
    status: 11,
    remarks: 11,
} as const;

// 7 borders (one per column + trailing) + 12 padding spaces (2 per column) + content widths
const BOARD_TOTAL_WIDTH =
    7 +
    (COL_WIDTHS.num + 2) +
    (COL_WIDTHS.destination + 2) +
    (COL_WIDTHS.time + 2) +
    (COL_WIDTHS.platform + 2) +
    (COL_WIDTHS.status + 2) +
    (COL_WIDTHS.remarks + 2);

const HEADER_ROW = 1;
const COL_HEADER_ROW = 3;
const FIRST_TRAIN_ROW = 5;
const TRAIN_ROW_HEIGHT = 1;
const MAX_TRAIN_ROWS = 8;

const LOG_START_ROW = FIRST_TRAIN_ROW + MAX_TRAIN_ROWS + 2;
const LOG_VISIBLE_LINES = 5;

/** Column label text for the header row. */
const COL_LABELS = {
    num: "#",
    destination: "DESTINATION",
    time: "TIME",
    platform: "PLAT",
    status: "STATUS",
    remarks: "REMARKS",
} as const;

// --- Cell management ---

/** Tracks the animated state of a single display cell. */
type CellState = {
    /** The string value currently displayed (or being animated toward). */
    displayValue: string;
    animation: SplitFlapAnimation | null;
};

/** The full display state — one CellState per (row, column) pair. */
type BoardState = {
    rows: Array<{
        id: CellState;
        destination: CellState;
        time: CellState;
        platform: CellState;
        status: CellState;
        remarks: CellState;
    }>;
    dispatchLog: DispatchLogEntry[];
    simTime: string;
};

const makeCell = (value: string): CellState => ({ displayValue: value, animation: null });

const makeEmptyRow = () => ({
    id: makeCell(""),
    destination: makeCell(""),
    time: makeCell(""),
    platform: makeCell(""),
    status: makeCell("EXPECTED"),
    remarks: makeCell(""),
});

/** Pad a value to exactly `width` chars for display. */
const padCell = (value: string, width: number): string =>
    value.toUpperCase().padEnd(width, " ").slice(0, width);

/** Apply status-appropriate color to a status string. */
const colorStatus = (status: string, width: number): string => {
    const s = status.trim();
    switch (s) {
        case "ON TIME":
            return green(s.padEnd(width));
        case "BOARDING":
            return cyan(s.padEnd(width));
        case "DELAYED":
            return red(s.padEnd(width));
        case "HELD":
            return red(s.padEnd(width));
        case "DEPARTED":
            return gray(s.padEnd(width));
        case "ARRIVED":
            return gray(s.padEnd(width));
        case "EXPECTED":
            return blue(s.padEnd(width));
        default:
            return amber(s.padEnd(width));
    }
};

/** Build a horizontal separator row for the board frame. */
const makeHSep = (left: string, mid: string, right: string): string => {
    const segments = [
        BOX.H.repeat(COL_WIDTHS.num + 2),
        BOX.H.repeat(COL_WIDTHS.destination + 2),
        BOX.H.repeat(COL_WIDTHS.time + 2),
        BOX.H.repeat(COL_WIDTHS.platform + 2),
        BOX.H.repeat(COL_WIDTHS.status + 2),
        BOX.H.repeat(COL_WIDTHS.remarks + 2),
    ];
    return left + segments.join(mid) + right;
};

/** Render a cell's current value, applying animation frame if active. */
const renderCellValue = (cell: CellState, width: number, nowMs: number): string => {
    if (cell.animation) {
        const frame = cell.animation.getFrame(nowMs);
        if (cell.animation.isComplete(nowMs)) {
            // Animation finished — freeze and clear.
            cell.displayValue = cell.animation.target;
            cell.animation = null;
            return amberDim(padCell(cell.displayValue, width));
        }
        return amberBright(frame);
    }
    return amberDim(padCell(cell.displayValue, width));
};

/**
 * Queues a split-flap animation for a cell if the new value differs.
 * No-ops if the value hasn't changed.
 */
const updateCell = (cell: CellState, newValue: string, width: number, nowMs: number): void => {
    const normalized = padCell(newValue, width);
    if (normalized === padCell(cell.displayValue, width)) {
        return;
    }
    cell.animation = createSplitFlapAnimation(cell.displayValue, normalized, width, nowMs);
    cell.displayValue = newValue;
};

// --- Public API ---

export type Display = {
    /** Update a train row with new state data. Triggers animations on changed cells. */
    updateTrain: (rowIndex: number, train: TrainRowState) => void;
    /** Clear a train row (e.g., after departure). */
    clearRow: (rowIndex: number) => void;
    /** Append a line to the dispatch log. Scrolls when full. */
    addLogEntry: (entry: DispatchLogEntry) => void;
    /** Update the simulated clock display. */
    setSimTime: (time: string) => void;
    /** Render one frame to stdout. */
    render: () => void;
    /** Set up terminal (alt screen, hidden cursor). */
    enter: () => void;
    /** Restore terminal to pre-run state. */
    exit: () => void;
};

export const createDisplay = (): Display => {
    const state: BoardState = {
        rows: Array.from({ length: MAX_TRAIN_ROWS }, makeEmptyRow),
        dispatchLog: [],
        simTime: "--:--:--",
    };

    const enter = (): void => {
        process.stdout.write(enterAltScreen() + clearScreen() + hideCursor());
    };

    const exit = (): void => {
        process.stdout.write(showCursor() + exitAltScreen());
    };

    const setSimTime = (time: string): void => {
        state.simTime = time;
    };

    const updateTrain = (rowIndex: number, train: TrainRowState): void => {
        if (rowIndex < 0 || rowIndex >= MAX_TRAIN_ROWS) {
            return;
        }
        const nowMs = Date.now();
        const row = state.rows[rowIndex];
        updateCell(row.id, train.id, COL_WIDTHS.num, nowMs);
        updateCell(row.destination, train.destination, COL_WIDTHS.destination, nowMs);
        updateCell(row.time, train.scheduledTime, COL_WIDTHS.time, nowMs);
        updateCell(row.platform, String(train.platform), COL_WIDTHS.platform, nowMs);
        updateCell(row.status, train.status, COL_WIDTHS.status, nowMs);
        updateCell(row.remarks, train.remarks, COL_WIDTHS.remarks, nowMs);
    };

    const clearRow = (rowIndex: number): void => {
        if (rowIndex < 0 || rowIndex >= MAX_TRAIN_ROWS) {
            return;
        }
        state.rows[rowIndex] = makeEmptyRow();
    };

    const addLogEntry = (entry: DispatchLogEntry): void => {
        state.dispatchLog.push(entry);
        // Keep the log bounded — older entries scroll off.
        if (state.dispatchLog.length > LOG_VISIBLE_LINES) {
            state.dispatchLog.shift();
        }
    };

    const render = (): void => {
        const nowMs = Date.now();
        const out: string[] = [];

        // --- Header ---
        const headerText = " POSTAL CENTRAL STATION";
        const clockText = state.simTime + " ";
        const headerInner =
            white(bold(headerText)) +
            " ".repeat(Math.max(0, BOARD_TOTAL_WIDTH - 2 - headerText.length - clockText.length)) +
            amber(clockText);
        out.push(moveTo(HEADER_ROW, BOARD_COL_START));
        out.push(amber(makeHSep(BOX.TL, BOX.TM, BOX.TR)));
        out.push(moveTo(HEADER_ROW + 1, BOARD_COL_START));
        out.push(amber(BOX.V) + headerInner + amber(BOX.V));

        // --- Column header row ---
        out.push(moveTo(COL_HEADER_ROW - 1, BOARD_COL_START));
        out.push(amber(makeHSep(BOX.LM, BOX.X, BOX.RM)));
        out.push(moveTo(COL_HEADER_ROW, BOARD_COL_START));
        out.push(
            amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.num, COL_WIDTHS.num)} `)) +
                amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.destination, COL_WIDTHS.destination)} `)) +
                amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.time, COL_WIDTHS.time)} `)) +
                amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.platform, COL_WIDTHS.platform)} `)) +
                amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.status, COL_WIDTHS.status)} `)) +
                amber(BOX.V) +
                white(bold(` ${padCell(COL_LABELS.remarks, COL_WIDTHS.remarks)} `)) +
                amber(BOX.V)
        );

        // --- Separator before data rows ---
        out.push(moveTo(COL_HEADER_ROW + 1, BOARD_COL_START));
        out.push(amber(makeHSep(BOX.LM, BOX.X, BOX.RM)));

        // --- Train rows ---
        state.rows.forEach((row, i) => {
            const termRow = FIRST_TRAIN_ROW + i * TRAIN_ROW_HEIGHT;
            out.push(moveTo(termRow, BOARD_COL_START));

            const idStr = renderCellValue(row.id, COL_WIDTHS.num, nowMs);
            const destStr = renderCellValue(row.destination, COL_WIDTHS.destination, nowMs);
            const timeStr = renderCellValue(row.time, COL_WIDTHS.time, nowMs);
            const platStr = renderCellValue(row.platform, COL_WIDTHS.platform, nowMs);
            // Status can't go through renderCellValue because it needs status-
            // specific color once landed. During animation we show amber like
            // every other cell; after landing we apply the status color.
            const rawStatus = row.status.displayValue.trim();
            const statusStr = row.status.animation
                ? amberBright(row.status.animation.getFrame(nowMs))
                : colorStatus(rawStatus, COL_WIDTHS.status);
            if (row.status.animation?.isComplete(nowMs)) {
                row.status.displayValue = row.status.animation.target;
                row.status.animation = null;
            }
            const remarksStr = renderCellValue(row.remarks, COL_WIDTHS.remarks, nowMs);

            out.push(
                amber(BOX.V) +
                    ` ${idStr} ` +
                    amber(BOX.V) +
                    ` ${destStr} ` +
                    amber(BOX.V) +
                    ` ${timeStr} ` +
                    amber(BOX.V) +
                    ` ${platStr} ` +
                    amber(BOX.V) +
                    ` ${statusStr} ` +
                    amber(BOX.V) +
                    ` ${remarksStr} ` +
                    amber(BOX.V)
            );
        });

        // --- Bottom border ---
        const bottomRow = FIRST_TRAIN_ROW + MAX_TRAIN_ROWS * TRAIN_ROW_HEIGHT;
        out.push(moveTo(bottomRow, BOARD_COL_START));
        out.push(amber(makeHSep(BOX.BL, BOX.BM, BOX.BR)));

        // --- Dispatch log ---
        const logWidth = BOARD_TOTAL_WIDTH - 4;
        out.push(moveTo(LOG_START_ROW, BOARD_COL_START));
        out.push(
            white(
                `  ${BOX.TL}${BOX.H} DISPATCH LOG ` +
                    BOX.H.repeat(Math.max(0, logWidth - 15)) +
                    BOX.TR
            )
        );

        for (let l = 0; l < LOG_VISIBLE_LINES; l++) {
            const entry = state.dispatchLog[l];
            const lineText = entry
                ? ` ${entry.timestamp}  ${entry.message}`.slice(0, logWidth)
                : "";
            out.push(moveTo(LOG_START_ROW + 1 + l, BOARD_COL_START));
            out.push(white(`  ${BOX.V}`) + gray(lineText.padEnd(logWidth)) + white(BOX.V));
        }

        out.push(moveTo(LOG_START_ROW + LOG_VISIBLE_LINES + 1, BOARD_COL_START));
        out.push(white(`  ${BOX.BL}${BOX.H.repeat(logWidth)}${BOX.BR}`));

        // Flush the entire frame in one write. Multiple small writes cause
        // visible tearing because the terminal redraws between them.
        process.stdout.write(out.join(""));
    };

    return { updateTrain, clearRow, addLogEntry, setSimTime, render, enter, exit };
};
