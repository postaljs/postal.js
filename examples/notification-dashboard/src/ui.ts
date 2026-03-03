/**
 * UI management for the Notification Dashboard.
 *
 * All direct DOM manipulation lives here. No postal imports — this module
 * has no knowledge of the message bus. main.ts wires postal callbacks to
 * these functions. That keeps the postal integration visible in one place.
 *
 * Key responsibilities:
 *   - Render notification feed entries with slide-in animation
 *   - Render wiretap feed entries (independent cap and scroll state)
 *   - Toggle subscription chip visual state
 *   - Delegate service button clicks with topic and generated payload
 *   - Maintain independent 75-entry caps on both feeds
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Data passed to addNotification(). Mirrors the envelope structure so
 *  main.ts can forward envelope fields directly without reshaping them. */
export type NotificationEntry = {
    topic: string;
    payload: unknown;
    channel: string;
    /** Milliseconds since epoch — matches envelope.timestamp (Date.now()). */
    timestamp: number;
    matchedPattern: string;
};

/** Data passed to addWiretapEntry(). Same shape — wiretap sees the full envelope. */
export type WiretapEntry = {
    topic: string;
    payload: unknown;
    channel: string;
    /** Milliseconds since epoch — matches envelope.timestamp (Date.now()). */
    timestamp: number;
};

/** Returned by getChipElements() so main.ts can wire subscribe/unsubscribe. */
export type ChipElement = {
    el: HTMLButtonElement;
    chipId: string;
    pattern: string;
    initiallyActive: boolean;
};

/** Callback signature for onServiceButton(). */
export type ServiceButtonCallback = (topic: string, payload: Record<string, unknown>) => void;

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Maximum entries in each feed before oldest are dropped. Independent per feed
 *  so the wiretap doesn't steal capacity from the notification feed. */
const MAX_FEED_ENTRIES = 75;

/** Service name → CSS badge class. Used for color-coding topic badges. */
const SERVICE_BADGE_CLASS: Record<string, string> = {
    users: "topic-badge-users",
    orders: "topic-badge-orders",
    payments: "topic-badge-payments",
    system: "topic-badge-system",
};

// ─── DOM helpers ───────────────────────────────────────────────────────────────

const getEl = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id) as T | null;
    if (!el) {
        throw new Error(`Expected element #${id} to exist`);
    }
    return el;
};

/** Extract the service prefix from a topic (first segment before the first dot). */
const serviceFromTopic = (topic: string): string => topic.split(".")[0] ?? "unknown";

/** Build a color-coded topic badge element. */
const buildTopicBadge = (topic: string): string => {
    const service = serviceFromTopic(topic);
    const cls = SERVICE_BADGE_CLASS[service] ?? "topic-badge-unknown";
    return `<span class="topic-badge ${cls}">${escapeHtml(topic)}</span>`;
};

/** Format a millisecond timestamp to a short HH:MM:SS string for feed display. */
const formatTime = (ms: number): string => {
    const d = new Date(ms);
    return d.toLocaleTimeString("en-US", { hour12: false });
};

/** Render an object's key/value pairs as a compact one-liner payload summary.
 *  Truncates long strings and limits to 3 keys so entries stay compact.
 *  All keys and values are escaped here — callers must NOT wrap the result
 *  in escapeHtml() again or they'll get double-encoded entities. */
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
        // String values get quoted; everything else is coerced then escaped.
        // Both the key and the value go through escapeHtml — object keys can
        // contain arbitrary content if the payload came from user input.
        const raw = typeof val === "string" ? `"${val}"` : String(val);
        // Truncate before escaping so we don't cut in the middle of an entity.
        const truncated = raw.length > 20 ? raw.slice(0, 17) + "…" : raw;
        return `${escapeHtml(k)}: ${escapeHtml(truncated)}`;
    });
    const suffix = Object.keys(obj).length > 3 ? ", …" : "";
    return `{ ${parts.join(", ")}${suffix} }`;
};

const escapeHtml = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

// ─── Feed management ───────────────────────────────────────────────────────────

/** Scroll to the top of a feed unless the user has scrolled down.
 *  Feeds prepend new entries at the top, so newest = top. The heuristic:
 *  if already within 60px of the top, snap back to 0. Otherwise the user
 *  has scrolled down to read older entries — leave them alone. */
const scrollToTopIfNear = (feed: HTMLElement): void => {
    if (feed.scrollTop < 60) {
        feed.scrollTop = 0;
    }
};

/** Prepend a DOM element to a feed, enforce the entry cap, and auto-scroll.
 *  "Prepend" here means insert at the top so newest entries appear first —
 *  but since we're using flex-col the visual order is top = newest. */
const prependToFeed = (feed: HTMLElement, entry: HTMLElement, maxEntries: number): void => {
    // Insert at the top of the feed
    feed.insertBefore(entry, feed.firstChild);

    // Drop oldest entries (last children) once we exceed the cap.
    // This keeps the DOM size bounded regardless of how long the demo runs.
    while (feed.children.length > maxEntries) {
        feed.removeChild(feed.lastChild as ChildNode);
    }

    scrollToTopIfNear(feed);
};

// ─── Public API ────────────────────────────────────────────────────────────────

/** Prepend a notification entry to the notification feed with slide-in animation.
 *  Hides the empty-state placeholder on first entry. Caps at MAX_FEED_ENTRIES. */
export const addNotification = (entry: NotificationEntry): void => {
    const feed = getEl("notif-feed");
    const empty = document.getElementById("notif-empty");

    if (empty) {
        empty.remove();
    }

    const el = document.createElement("div");
    el.className = "feed-entry";
    el.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-1.5">
            ${buildTopicBadge(entry.topic)}
            <span class="text-xs text-zinc-600 font-mono flex-shrink-0">${formatTime(entry.timestamp)}</span>
        </div>
        <div class="text-xs text-zinc-400 font-mono leading-relaxed mb-1.5 truncate">
            ${formatPayload(entry.payload)}
        </div>
        <div class="text-xs text-zinc-600">
            matched <code class="text-zinc-500 bg-zinc-800 px-1 rounded">${escapeHtml(entry.matchedPattern)}</code>
        </div>
    `;

    prependToFeed(feed, el, MAX_FEED_ENTRIES);

    // Use the live DOM count so the badge reflects evictions — a lifetime
    // incrementing counter drifts above MAX_FEED_ENTRIES after the cap kicks in.
    getEl("notif-count").textContent = String(feed.children.length);
};

/** Prepend a wiretap entry to the wiretap feed with slide-in animation.
 *  Independent from the notification feed — own cap and scroll state. */
export const addWiretapEntry = (entry: WiretapEntry): void => {
    const feed = getEl("wiretap-feed");
    const empty = document.getElementById("wiretap-empty");

    if (empty) {
        empty.remove();
    }

    const el = document.createElement("div");
    el.className = "wiretap-entry";
    el.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-1">
            ${buildTopicBadge(entry.topic)}
            <span class="text-xs text-zinc-600 font-mono flex-shrink-0">${formatTime(entry.timestamp)}</span>
        </div>
        <div class="text-xs text-zinc-500 font-mono truncate">
            ${formatPayload(entry.payload)}
        </div>
    `;

    prependToFeed(feed, el, MAX_FEED_ENTRIES);

    // Use the live DOM count so the badge reflects evictions — a lifetime
    // incrementing counter drifts above MAX_FEED_ENTRIES after the cap kicks in.
    getEl("wiretap-count").textContent = String(feed.children.length);
};

/** Toggle the visual active/inactive state of a subscription chip. */
export const setChipActive = (chipId: string, active: boolean): void => {
    const chip = document.querySelector<HTMLButtonElement>(`[data-chip-id="${chipId}"]`);
    if (!chip) {
        return;
    }
    chip.classList.remove("chip-active", "chip-inactive");
    chip.classList.add(active ? "chip-active" : "chip-inactive");
};

/** Return all chip elements with their pattern and initial-active state.
 *  main.ts uses this to wire up subscribe/unsubscribe on each chip. */
export const getChipElements = (): ChipElement[] => {
    const chips = document.querySelectorAll<HTMLButtonElement>("[data-chip-id]");
    return Array.from(chips).map(el => ({
        el,
        chipId: el.dataset.chipId ?? "",
        pattern: el.dataset.pattern ?? "",
        initiallyActive: el.classList.contains("chip-active"),
    }));
};

/** Register a delegated click handler for all service buttons.
 *  The callback receives the topic from data-topic and a payload generated
 *  by the payload generators in main.ts (passed in as a lookup). */
export const onServiceButton = (callback: ServiceButtonCallback): void => {
    // Delegate from the parent .service-btn container so we don't need to
    // re-register listeners when buttons are added or removed.
    document.addEventListener("click", e => {
        const target = (e.target as HTMLElement).closest<HTMLButtonElement>(".service-btn");
        if (!target) {
            return;
        }
        const topic = target.dataset.topic ?? "";
        if (!topic) {
            return;
        }

        // Visual press feedback — add the flash class, remove after animation.
        // The animation duration matches @keyframes btn-flash (0.2s).
        target.classList.add("service-btn-flash");
        target.addEventListener(
            "animationend",
            () => target.classList.remove("service-btn-flash"),
            { once: true }
        );

        callback(topic, {});
    });
};
