/**
 * Notification Dashboard — main entry point.
 *
 * This file is the postal integration. Every postal API call lives here so
 * the library's surface is scannable in one place. DOM manipulation is
 * delegated to ui.ts.
 *
 * What happens here:
 *   1. Channel setup — getChannel("notifications")
 *   2. Service definitions — topics and payload generators per service
 *   3. Service button wiring — publish on click via ui.onServiceButton()
 *   4. Subscription chip wiring — real subscribe()/unsubscribe() on toggle
 *   5. Wiretap — addWiretap() sees everything, subscription state irrelevant
 */

import "./styles.css";

import { getChannel, addWiretap } from "postal";
import type { Envelope } from "postal";
import {
    addNotification,
    addWiretapEntry,
    setChipActive,
    getChipElements,
    onServiceButton,
} from "./ui";

// ─── Channel ───────────────────────────────────────────────────────────────────

// All messages flow through a single named channel. getChannel() is idempotent —
// calling it again with the same name returns the same channel.
const channel = getChannel("notifications");

// ─── Service definitions ───────────────────────────────────────────────────────

// Map of topic → payload generator. Each service button publishes a realistic
// but entirely fake payload. The content doesn't matter — it's there to make
// the notification feed look like real data.
const PAYLOAD_GENERATORS: Record<string, () => Record<string, unknown>> = {
    "users.login": () => ({
        userId: randomId("usr"),
        email: randomEmail(),
        at: new Date().toISOString(),
    }),
    "users.logout": () => ({
        userId: randomId("usr"),
        sessionDuration: randomDuration(),
    }),
    "users.signup": () => ({
        userId: randomId("usr"),
        email: randomEmail(),
        plan: randomPick(["free", "pro", "enterprise"]),
    }),
    "orders.created": () => ({
        orderId: randomId("ord"),
        total: randomAmount(),
        items: randomCount(1, 8),
    }),
    "orders.shipped": () => ({
        orderId: randomId("ord"),
        carrier: randomPick(["UPS", "FedEx", "USPS"]),
        tracking: randomId("trk"),
    }),
    "orders.cancelled": () => ({
        orderId: randomId("ord"),
        reason: randomPick(["customer_request", "out_of_stock", "payment_failed"]),
    }),
    "payments.received": () => ({
        paymentId: randomId("pay"),
        amount: randomAmount(),
        method: randomPick(["card", "ach", "wire"]),
    }),
    "payments.refund.initiated": () => ({
        refundId: randomId("ref"),
        orderId: randomId("ord"),
        amount: randomAmount(),
    }),
    "payments.refund.completed": () => ({
        refundId: randomId("ref"),
        amount: randomAmount(),
        at: new Date().toISOString(),
    }),
    "system.health.ok": () => ({
        service: randomPick(["api", "worker", "cache", "db"]),
        latencyMs: randomCount(1, 80),
    }),
    "system.deploy.started": () => ({
        version: `v${randomCount(1, 9)}.${randomCount(0, 19)}.${randomCount(0, 5)}`,
        environment: randomPick(["staging", "production"]),
        triggeredBy: randomEmail(),
    }),
    "system.error": () => ({
        code: randomPick(["E_TIMEOUT", "E_CONN_REFUSED", "E_RATE_LIMITED"]),
        service: randomPick(["api", "worker", "cache"]),
        retryable: randomPick([true, false]),
    }),
};

// ─── Service button wiring ─────────────────────────────────────────────────────

// onServiceButton() handles delegation — one listener for all buttons.
// Each click publishes a message on the button's data-topic with a generated payload.
onServiceButton((topic, _providedPayload) => {
    const generator = PAYLOAD_GENERATORS[topic];
    // Fall back to an empty payload if somehow a topic has no generator.
    const payload = generator ? generator() : {};
    channel.publish(topic, payload);
});

// ─── Subscription chip wiring ──────────────────────────────────────────────────

// Each chip stores its own unsubscribe function in a closure — no external Map.
// Toggling calls unsubscribe() on the stored function or subscribe() to get a new one.
getChipElements().forEach(({ el, chipId, pattern, initiallyActive }) => {
    // The subscribe callback adds a notification entry for matched messages.
    // The envelope contains the matched pattern — we pass it through so the
    // feed entry can show which subscription caught this message.
    const makeCallback = (matchedPattern: string) => (envelope: Envelope) => {
        addNotification({
            topic: envelope.topic,
            payload: envelope.payload,
            channel: envelope.channel,
            timestamp: envelope.timestamp,
            matchedPattern,
        });
    };

    // Start with the chip in its HTML-declared state (active or inactive).
    let unsubscribe: (() => void) | null = null;

    if (initiallyActive) {
        // channel.subscribe() returns the unsubscribe function directly.
        unsubscribe = channel.subscribe(pattern, makeCallback(pattern));
    }

    el.addEventListener("click", () => {
        if (unsubscribe !== null) {
            // Currently active — unsubscribe and mark inactive
            unsubscribe();
            unsubscribe = null;
            setChipActive(chipId, false);
        } else {
            // Currently inactive — subscribe and store the unsubscribe function
            unsubscribe = channel.subscribe(pattern, makeCallback(pattern));
            setChipActive(chipId, true);
        }
    });
});

// ─── Wiretap ───────────────────────────────────────────────────────────────────

// addWiretap() registers a global observer. It fires for EVERY message published
// to the bus — including ones that don't match any active subscription.
// This is the core teaching moment: wiretap is orthogonal to subscriptions.
addWiretap((envelope: Envelope) => {
    addWiretapEntry({
        topic: envelope.topic,
        payload: envelope.payload,
        channel: envelope.channel,
        timestamp: envelope.timestamp,
    });
});

// ─── Payload generators ────────────────────────────────────────────────────────

// Simple random data helpers. crypto.randomUUID() is available in all modern
// browsers — no library needed for realistic-looking IDs.

const randomId = (prefix: string): string => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const randomAmount = (): string => (Math.random() * 500 + 5).toFixed(2);

const randomCount = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

const randomDuration = (): string => `${randomCount(1, 180)}m`;

const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

const randomEmail = (): string => {
    const users = ["alice", "bob", "carol", "dave", "eve", "frank"];
    const domains = ["example.com", "acme.io", "corp.dev"];
    return `${randomPick(users)}@${randomPick(domains)}`;
};
