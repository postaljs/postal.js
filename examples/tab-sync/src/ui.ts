/**
 * UI management for the Tab Sync Dashboard.
 *
 * All direct DOM manipulation lives here. No postal imports — this module
 * has no knowledge of the message bus. main.ts wires postal callbacks to
 * these functions, keeping the postal surface visible in one place.
 *
 * Key responsibilities:
 *   - Apply AppState to the DOM (theme, auth, prefs, tab ID)
 *   - Render activity log entries with slide-in animation
 *   - Flash the sync indicator on remote messages
 *   - Wire toggle switches and auth buttons, exposing callbacks to main.ts
 */

import type { AppState, Theme, Prefs } from "./state";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum activity log entries before oldest are evicted. */
const MAX_ACTIVITY_ENTRIES = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActivityEntry = {
    topic: string;
    payload: unknown;
    /** Milliseconds since epoch — matches envelope.timestamp (Date.now()). */
    timestamp: number;
    /** True if this message originated from another tab, false if local. */
    isRemote: boolean;
};

// ─── DOM helpers ────────────────────────────────────────────────────────────

const getEl = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id) as T | null;
    if (!el) {
        throw new Error(`Expected element #${id} to exist`);
    }
    return el;
};

/** Format a millisecond timestamp to HH:MM:SS for feed display. */
const formatTime = (ms: number): string => {
    const d = new Date(ms);
    return d.toLocaleTimeString("en-US", { hour12: false });
};

/** Escape user content before inserting into innerHTML. */
const escapeHtml = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/** Render a payload as a compact one-liner, capped at 3 keys, 20 chars per value. */
const formatPayload = (payload: unknown): string => {
    if (payload === null || payload === undefined) {
        return "—";
    }
    if (typeof payload !== "object" || Array.isArray(payload)) {
        return escapeHtml(String(payload));
    }
    const obj = payload as Record<string, unknown>;
    const keys = Object.keys(obj).slice(0, 3);
    const parts = keys.map(k => {
        const val = obj[k];
        const raw = typeof val === "string" ? `"${val}"` : String(val);
        const truncated = raw.length > 20 ? raw.slice(0, 17) + "…" : raw;
        return `${escapeHtml(k)}: ${escapeHtml(truncated)}`;
    });
    const suffix = Object.keys(obj).length > 3 ? ", …" : "";
    return `{ ${parts.join(", ")}${suffix} }`;
};

/** Extract the topic namespace (first segment before the first dot). */
const namespaceFromTopic = (topic: string): string => topic.split(".")[0] ?? "unknown";

/** Build a color-coded topic badge. */
const buildTopicBadge = (topic: string): string => {
    const ns = namespaceFromTopic(topic);
    const cls =
        ns === "auth"
            ? "topic-badge-auth"
            : ns === "theme"
              ? "topic-badge-theme"
              : ns === "prefs"
                ? "topic-badge-prefs"
                : ns === "sync"
                  ? "topic-badge-sync"
                  : "topic-badge-unknown";
    return `<span class="topic-badge ${cls}">${escapeHtml(topic)}</span>`;
};

// ─── Feed management ────────────────────────────────────────────────────────

/** Prepend a DOM element to a feed and enforce the entry cap. */
const prependToFeed = (feed: HTMLElement, entry: HTMLElement): void => {
    feed.insertBefore(entry, feed.firstChild);

    // Drop oldest entries (last children) once we exceed the cap so the DOM
    // stays bounded regardless of how long the demo runs.
    while (feed.children.length > MAX_ACTIVITY_ENTRIES) {
        feed.removeChild(feed.lastChild as ChildNode);
    }

    // Auto-scroll to top if the user is already near the top — don't
    // interrupt if they've scrolled down to read older entries.
    if (feed.scrollTop < 60) {
        feed.scrollTop = 0;
    }
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Set the tab ID display in the header.
 * Called once at startup with the random hex ID generated in main.ts.
 */
export const setTabId = (id: string): void => {
    getEl("tab-id").textContent = id;
};

/**
 * Apply the full AppState to the DOM.
 *
 * Called on initial hydration and after every state change (local or remote).
 * Sets theme, auth UI, pref toggles, and theme icon/label.
 */
export const applyState = (state: AppState): void => {
    // Theme — data-theme on <html> drives CSS custom properties + transition
    document.documentElement.setAttribute("data-theme", state.theme);

    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");
    const themeToggle = document.getElementById("theme-toggle");

    if (themeIcon) {
        themeIcon.textContent = state.theme === "dark" ? "🌙" : "☀️";
    }
    if (themeLabel) {
        themeLabel.textContent = state.theme === "dark" ? "Dark mode" : "Light mode";
    }
    if (themeToggle) {
        themeToggle.setAttribute("aria-checked", state.theme === "dark" ? "true" : "false");
    }

    // Auth — show the correct panel based on login state
    const loggedOut = document.getElementById("auth-logged-out");
    const loggedIn = document.getElementById("auth-logged-in");
    const authUsername = document.getElementById("auth-username");

    if (loggedOut && loggedIn) {
        if (state.username) {
            loggedOut.style.display = "none";
            loggedIn.style.display = "";
            if (authUsername) {
                authUsername.textContent = state.username;
            }
        } else {
            loggedOut.style.display = "";
            loggedIn.style.display = "none";
        }
    }

    // Prefs — sync toggle aria-checked state with stored prefs
    const soundsToggle = document.getElementById("pref-sounds-toggle");
    const compactToggle = document.getElementById("pref-compact-toggle");

    if (soundsToggle) {
        soundsToggle.setAttribute("aria-checked", String(state.prefs.sounds));
    }
    if (compactToggle) {
        compactToggle.setAttribute("aria-checked", String(state.prefs.compactView));
    }
};

/**
 * Flash the sync indicator dot.
 * Called by main.ts when a message arrives from another tab.
 */
export const flashSyncDot = (): void => {
    const dot = document.getElementById("sync-dot");
    if (!dot) {
        return;
    }
    // Remove the class first so re-triggering during a running animation restarts it.
    dot.classList.remove("sync-flash");
    // Force reflow so the browser treats the re-add as a fresh animation start.
    void dot.offsetWidth;
    dot.classList.add("sync-flash");
    dot.addEventListener("animationend", () => dot.classList.remove("sync-flash"), { once: true });
};

/**
 * Prepend an entry to the activity log.
 * Remote entries get a green flash; local entries get the default flash.
 */
export const addActivityEntry = (entry: ActivityEntry): void => {
    const feed = getEl("activity-feed");
    const empty = document.getElementById("activity-empty");

    if (empty) {
        empty.remove();
    }

    const originLabel = entry.isRemote
        ? `<span class="text-green-400 font-semibold">remote</span>`
        : `<span class="theme-text-faint">local</span>`;

    const el = document.createElement("div");
    el.className = `activity-entry${entry.isRemote ? " remote" : ""}`;
    el.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1">
            ${buildTopicBadge(entry.topic)}
            <div class="flex items-center gap-2 flex-shrink-0">
                ${originLabel}
                <span class="text-xs theme-text-faint font-mono">${formatTime(entry.timestamp)}</span>
            </div>
        </div>
        <div class="text-xs theme-text-faint font-mono truncate">
            ${formatPayload(entry.payload)}
        </div>
    `;

    prependToFeed(feed, el);

    // Use live DOM count so the badge reflects evictions accurately.
    getEl("activity-count").textContent = String(feed.children.length);
};

/**
 * Show the connected-tab count and make the indicator visible.
 * Called by main.ts from the sync.clients.changed subscriber.
 * The container starts hidden so it only appears once the SW has connected.
 */
export const setConnectedTabCount = (count: number): void => {
    getEl("connected-tabs").textContent = String(count);
    getEl("connected-tabs-container").style.display = "";
};

/**
 * Hide the connected-tab count indicator.
 * Called when the SW disconnects so a stale count isn't shown.
 */
export const hideConnectedTabCount = (): void => {
    getEl("connected-tabs-container").style.display = "none";
};

/**
 * Wire the login button click. Calls back with the trimmed username if non-empty.
 * Handles both the button click and Enter key in the input.
 */
export const onLogin = (callback: (username: string) => void): void => {
    const btn = getEl<HTMLButtonElement>("login-btn");
    const input = getEl<HTMLInputElement>("username-input");

    const attempt = (): void => {
        const username = input.value.trim();
        if (!username) {
            input.focus();
            return;
        }
        callback(username);
        input.value = "";
    };

    btn.addEventListener("click", attempt);
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            attempt();
        }
    });
};

/**
 * Wire the logout button click.
 */
export const onLogout = (callback: () => void): void => {
    getEl<HTMLButtonElement>("logout-btn").addEventListener("click", callback);
};

/**
 * Wire the theme toggle switch.
 * Calls back with the new theme value after each click.
 */
export const onThemeToggle = (callback: (theme: Theme) => void): void => {
    getEl<HTMLButtonElement>("theme-toggle").addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") as Theme;
        callback(current === "dark" ? "light" : "dark");
    });
};

/**
 * Wire the preference toggles. Calls back with updated Prefs after each click.
 * Reading from aria-checked gives us the current committed state — we flip it,
 * then call back so main.ts can publish and persist.
 */
export const onPrefsToggle = (getPrefs: () => Prefs, callback: (prefs: Prefs) => void): void => {
    getEl<HTMLButtonElement>("pref-sounds-toggle").addEventListener("click", () => {
        const current = getPrefs();
        callback({ ...current, sounds: !current.sounds });
    });

    getEl<HTMLButtonElement>("pref-compact-toggle").addEventListener("click", () => {
        const current = getPrefs();
        callback({ ...current, compactView: !current.compactView });
    });
};
