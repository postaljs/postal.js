/**
 * AppState type and localStorage helpers.
 *
 * Pure data module — no postal, no DOM. Both main.ts and ui.ts import
 * from here so the state shape is defined in one place.
 *
 * Pattern: localStorage for persistence, BroadcastChannel (via postal) for
 * real-time notification. New tabs hydrate from storage on load; live changes
 * propagate through the bus and are persisted by the subscriber.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark";

export type Prefs = {
    sounds: boolean;
    compactView: boolean;
};

export type AppState = {
    /** Null means no one is logged in. */
    username: string | null;
    theme: Theme;
    prefs: Prefs;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "postal-tab-sync-state";

export const DEFAULT_STATE: AppState = {
    username: null,
    theme: "dark",
    prefs: {
        sounds: true,
        compactView: false,
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read AppState from localStorage, merging over DEFAULT_STATE so that new
 * fields added in future versions don't cause missing-key bugs.
 */
export const loadState = (): AppState => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_STATE };
        }
        const parsed = JSON.parse(raw) as Partial<AppState>;
        // Spread preserves defaults for any fields missing from stored JSON,
        // and the nested prefs spread handles new preference keys the same way.
        return {
            ...DEFAULT_STATE,
            ...parsed,
            prefs: {
                ...DEFAULT_STATE.prefs,
                ...(parsed.prefs ?? {}),
            },
        };
    } catch {
        // Incognito mode or corrupted JSON — start fresh.
        return { ...DEFAULT_STATE };
    }
};

/**
 * Write AppState to localStorage.
 * try/catch for incognito mode where storage writes throw SecurityError.
 */
export const saveState = (state: AppState): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Incognito or storage quota — nothing to do, the in-memory state is
        // still correct for this tab.
    }
};
