/**
 * ServiceWorker entry for the tab-sync demo.
 *
 * Two things happen here:
 *   1. listenForClients() sets up the postal MessagePort transport plumbing —
 *      one dedicated port per connected tab, ack/syn handshake, automatic
 *      cleanup on port close.
 *   2. A second "message" listener on self tracks presence via clients.matchAll().
 *      We query the browser's actual client list instead of manual counting
 *      because port close events are unreliable on refresh — the new tab's syn
 *      arrives before the old port's close fires, causing phantom inflation.
 *
 * This SW has its own postal module scope — getChannel("sync").publish() here
 * sends to the MessagePort transports connected to each tab. It does NOT share
 * the tab's postal instance.
 */

import { getChannel } from "postal";
import { listenForClients } from "postal-transport-serviceworker/sw";

// TypeScript's lib.webworker types `self` as WorkerGlobalScope. The cast is
// unavoidable without a separate @types/serviceworker package, but at runtime
// in a SW context this is ServiceWorkerGlobalScope and the APIs exist.
const swSelf = self as unknown as ServiceWorkerGlobalScope;

// ─── Transport ───────────────────────────────────────────────────────────────

// Sets up the postal MessagePort transport layer — one port per tab, handles
// the syn/ack handshake, and cleans up on port close. We call this first so
// transport registration happens before our counting listener fires.
listenForClients();

// ─── Presence tracking ──────────────────────────────────────────────────────

const syncChannel = getChannel("sync");

// Inline syn predicate — isSwSyn is exported from the root postal-transport-serviceworker
// entrypoint, but importing from there would pull client-side code into the SW bundle.
// The /sw subpath only exports listenForClients. Shape from protocol.ts:
// { type: "postal:sw-syn", version: number }.
const isSwSyn = (data: unknown): boolean => {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        (data as { type: unknown }).type === "postal:sw-syn"
    );
};

// Query the browser's controlled-client list for the real count. This avoids
// the race where a refresh sends a new syn before the old port's close fires.
// Requires clients.claim() in the activate handler (below) so that clients
// are controlled immediately.
const broadcastClientCount = async () => {
    const clients = await swSelf.clients.matchAll({ type: "window" });
    syncChannel.publish("sync.clients.changed", { count: clients.length });
};

swSelf.addEventListener("message", (event: ExtendableMessageEvent) => {
    if (!isSwSyn(event.data) || event.ports.length === 0) {
        return;
    }

    // New tab connected — broadcast the updated count.
    broadcastClientCount();

    // When this tab's port closes (unload, navigate away, or removeTransport()),
    // broadcast again so remaining tabs see the decremented count.
    event.ports[0].addEventListener("close", () => {
        broadcastClientCount();
    });
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────

swSelf.addEventListener("activate", (event: ExtendableEvent) => {
    // claim() lets this SW control tabs immediately without waiting for a reload.
    // Without it, the first tab that registered the SW won't see it as active
    // until the user navigates.
    event.waitUntil(swSelf.clients.claim());
});
