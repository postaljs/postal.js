/**
 * Tab Sync Dashboard — main entry point.
 *
 * This file is the postal integration. Every postal API call lives here so
 * the library's surface is scannable in one place. DOM manipulation is
 * delegated to ui.ts; state persistence is delegated to state.ts.
 *
 * What happens here:
 *   1. Tab ID — random 4-char hex so you can tell tabs apart
 *   2. State hydration — loadState() on startup, applyState() to render
 *   3. Transport setup — BroadcastChannel for cross-tab fan-out; ServiceWorker
 *      MessagePort for point-to-point presence coordination
 *   4. Channel — getChannel("sync") scopes all messages
 *   5. Subscriptions — auth.login, auth.logout, theme.changed, prefs.changed,
 *      sync.clients.changed. Each subscriber is the single code path for that
 *      state change regardless of origin.
 *   6. User action wiring — publishes only, no state mutation here
 *   7. Wiretap — feeds the activity log, shows local + remote traffic
 */

import "./styles.css";

import { getChannel, addWiretap, addTransport } from "postal";
import type { Envelope } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";
import { connectToServiceWorker } from "postal-transport-serviceworker";
import { loadState, saveState } from "./state";
import type { AppState } from "./state";
import {
    setTabId,
    applyState,
    flashSyncDot,
    addActivityEntry,
    onLogin,
    onLogout,
    onThemeToggle,
    onPrefsToggle,
    setConnectedTabCount,
    hideConnectedTabCount,
} from "./ui";

// ─── Tab identity ────────────────────────────────────────────────────────────

// Each tab gets a unique short ID so users can distinguish tabs in the activity
// log. 4 hex chars give 65,536 possibilities — plenty for a demo.
const TAB_ID = crypto
    .getRandomValues(new Uint8Array(2))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

setTabId(TAB_ID);

// ─── State ───────────────────────────────────────────────────────────────────

// Mutable reference to the current application state. Subscribers update this
// on every state change so user action handlers always see the latest values.
let state: AppState = loadState();
applyState(state);

// ─── Transport ───────────────────────────────────────────────────────────────

// BroadcastChannel bridges postal messages to other same-origin tabs.
// The channel name must match across tabs — any tab using "tab-sync-demo"
// joins the same mesh automatically. No handshake required.
const transport = createBroadcastChannelTransport("tab-sync-demo");
addTransport(transport);

// ─── Channel ─────────────────────────────────────────────────────────────────

const channel = getChannel("sync");

// ─── Subscriptions ───────────────────────────────────────────────────────────

// Each subscriber is the single code path for that state change — it fires
// whether the publish came from this tab or arrived via the transport from
// another tab. Echo prevention lives in postal core (transport.ts): outbound
// envelopes are stamped with source: instanceId, and inbound envelopes
// matching the local instanceId are dropped before subscribers fire.

channel.subscribe("auth.login", (envelope: Envelope) => {
    const { username } = envelope.payload as { username: string; tabId: string };
    state = { ...state, username };
    saveState(state);
    applyState(state);
});

channel.subscribe("auth.logout", (_envelope: Envelope) => {
    state = { ...state, username: null };
    saveState(state);
    applyState(state);
});

channel.subscribe("theme.changed", (envelope: Envelope) => {
    const { theme } = envelope.payload as { theme: AppState["theme"]; tabId: string };
    state = { ...state, theme };
    saveState(state);
    applyState(state);
});

channel.subscribe("prefs.changed", (envelope: Envelope) => {
    const { prefs } = envelope.payload as { prefs: AppState["prefs"]; tabId: string };
    state = { ...state, prefs };
    saveState(state);
    applyState(state);
});

channel.subscribe("sync.clients.changed", (envelope: Envelope) => {
    const { count } = envelope.payload as { count: number };
    setConnectedTabCount(count);
});

// ─── User action wiring ──────────────────────────────────────────────────────

// User actions only publish — subscribers handle all state mutation.
// This keeps the publish/subscribe flow symmetrical whether the action
// originates locally or from another tab.

onLogin((username: string) => {
    channel.publish("auth.login", { username, tabId: TAB_ID });
});

onLogout(() => {
    channel.publish("auth.logout", { tabId: TAB_ID });
});

onThemeToggle(theme => {
    channel.publish("theme.changed", { theme, tabId: TAB_ID });
});

// getPrefs() lets ui.ts read the current prefs without importing state.ts
// directly — state is owned by main.ts.
onPrefsToggle(
    () => state.prefs,
    prefs => {
        channel.publish("prefs.changed", { prefs, tabId: TAB_ID });
    }
);

// ─── ServiceWorker transport ─────────────────────────────────────────────────

// Runs async and non-blocking so the BC transport and subscriptions are ready
// immediately. The tab count indicator appears once the SW handshake completes —
// there's a brief window at startup where it stays hidden. That's fine for a demo.
if ("serviceWorker" in navigator) {
    (async () => {
        try {
            await navigator.serviceWorker.register("/sw.js", { type: "module" });
            const registration = await navigator.serviceWorker.ready;
            await connectToServiceWorker(registration, {
                onDisconnect: () => {
                    // SW was replaced (update or unregister) — the old port is
                    // dead. Hide the count so we don't show a stale number.
                    console.warn("[tab-sync] ServiceWorker disconnected — tab count hidden");
                    hideConnectedTabCount();
                },
            });
        } catch (err) {
            // SW registration or handshake failed. The BC transport still works —
            // state sync continues normally; only the tab count indicator is affected.
            console.warn("[tab-sync] ServiceWorker setup failed:", err);
        }
    })();
}

// ─── Wiretap ─────────────────────────────────────────────────────────────────

// addWiretap() sees every message on the bus — both local publishes and
// messages arriving from other tabs via the transport. The activity log
// is 100% wiretap; subscribers above don't feed it at all.
//
// We detect remote messages by checking whether the envelope's source field
// differs from the local instanceId. postal stamps source: instanceId on
// outbound envelopes — if it's present and not our own, the message came
// from another tab.
addWiretap((envelope: Envelope) => {
    // envelope.source is stamped by broadcastToTransports() on outbound envelopes.
    // Local publishes never have source set. If source is present, the envelope
    // arrived via the transport from another tab (postal's echo prevention already
    // dropped any re-echoed copies of our own messages).
    const isRemote = envelope.source !== undefined;

    if (isRemote) {
        flashSyncDot();
    }

    addActivityEntry({
        topic: envelope.topic,
        payload: envelope.payload,
        timestamp: envelope.timestamp,
        isRemote,
    });
});
