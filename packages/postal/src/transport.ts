/**
 * Global transport layer for bridging postal across execution boundaries.
 *
 * Transports are one-way pipes — postal publishes locally, transports
 * forward to remotes. Inbound envelopes are dispatched locally.
 * Echo prevention uses the Envelope `source` field: outbound stamps
 * `instanceId`, inbound skips if `source` matches the local instance.
 *
 * @module
 */

import type { Envelope } from "./envelope";
import { matchTopic } from "./topicMatch";
import { getInstanceId, setOutboundHook, dispatchInbound, onReset } from "./channel";

// --- Public types ---

/**
 * Metadata passed to `Transport.send()` by the core.
 *
 * Transports can use this to make send-time decisions that require context
 * the transport can't determine on its own. Currently carries `peerCount` so
 * a transport knows whether other transports are also receiving this envelope.
 *
 * Transports that don't need this can safely ignore it — the parameter is optional.
 */
export type TransportSendMeta = {
    /**
     * Number of transports that passed the filter for this envelope
     * (including the current transport).
     *
     * A value of 1 means this transport is the sole recipient.
     * A value > 1 means multiple transports are receiving the same envelope.
     */
    peerCount: number;
};

/**
 * A transport bridges postal across execution boundaries (iframes, workers, tabs).
 *
 * Implementers provide `send` (push envelopes to the remote) and `subscribe`
 * (receive envelopes from the remote). Postal handles the wiring — echo
 * prevention, filtering, and local dispatch are managed internally.
 */
export type Transport = {
    /** Send an envelope to the remote side. */
    send: (envelope: Envelope, meta?: TransportSendMeta) => void;
    /** Listen for envelopes arriving from the remote side. Returns an unsubscribe function. */
    subscribe: (callback: (envelope: Envelope) => void) => () => void;
    /** Optional cleanup when the transport is removed or reset. */
    dispose?: () => void;
};

/** Restricts which envelopes a transport forwards. */
export type TransportFilter = {
    /** Only forward envelopes on these channels. Exact match. */
    channels?: string[];
    /** Only forward envelopes matching these topic patterns. Uses AMQP wildcard matching. */
    topics?: string[];
};

/** Options when registering a transport. */
export type TransportOptions = {
    /** Optional filter restricting which envelopes this transport forwards. */
    filter?: TransportFilter;
};

// --- Internal state ---

type RegisteredTransport = {
    transport: Transport;
    filter?: TransportFilter;
    unsubscribeInbound: () => void;
};

const transports: RegisteredTransport[] = [];

// --- Filter ---

/**
 * Tests whether an envelope passes a transport's filter.
 * Reply envelopes always pass — they complete an RPC round-trip
 * for a request that already matched on the way out.
 */
const passesFilter = (envelope: Envelope, filter?: TransportFilter): boolean => {
    if (!filter) {
        return true;
    }

    if (envelope.type === "reply") {
        return true;
    }

    if (filter.channels && filter.channels.length > 0) {
        if (!filter.channels.includes(envelope.channel)) {
            return false;
        }
    }

    if (filter.topics && filter.topics.length > 0) {
        if (!filter.topics.some(pattern => matchTopic(pattern, envelope.topic))) {
            return false;
        }
    }

    return true;
};

// --- Outbound ---

/**
 * Broadcasts an envelope to all registered transports that pass their filter.
 * Stamps each outbound copy with `source: instanceId` for echo prevention.
 *
 * Pre-filters into a list first so `peerCount` can be passed as meta —
 * some transports (e.g. MessagePort) use this to decide between zero-copy
 * transfer and structured clone when binary payloads are involved.
 */
const broadcastToTransports = (envelope: Envelope): void => {
    if (transports.length === 0) {
        return;
    }

    const source = getInstanceId();
    const matching = transports.filter(entry => passesFilter(envelope, entry.filter));
    const meta: TransportSendMeta = { peerCount: matching.length };

    for (const entry of matching) {
        // Shallow copy with source stamp — never mutate the original.
        entry.transport.send({ ...envelope, source }, meta);
    }
};

// --- Inbound ---

/**
 * Creates an inbound handler for a transport subscription.
 * Performs echo prevention, then dispatches into the local bus.
 */
const createInboundHandler =
    () =>
    (envelope: Envelope): void => {
        if (envelope.source === getInstanceId()) {
            return;
        }

        dispatchInbound(envelope);
    };

// --- Hook lifecycle ---

/**
 * Wires or unwires the outbound hook based on whether any transports exist.
 * No overhead on publish when no transports are registered.
 */
const syncOutboundHook = (): void => {
    setOutboundHook(transports.length > 0 ? broadcastToTransports : null);
};

// --- Public API ---

/**
 * Registers a transport with postal.
 *
 * The transport will receive outbound envelopes (filtered by options) and
 * can inject inbound envelopes into the local bus. Returns a function
 * that removes this transport.
 *
 * @param transport - The transport to register
 * @param options - Optional filter configuration
 * @returns A remove function (idempotent)
 */
export const addTransport = (transport: Transport, options?: TransportOptions): (() => void) => {
    const unsubscribeInbound = transport.subscribe(createInboundHandler());

    const entry: RegisteredTransport = {
        transport,
        filter: options?.filter,
        unsubscribeInbound,
    };

    transports.push(entry);
    syncOutboundHook();

    let removed = false;

    return () => {
        if (removed) {
            return;
        }
        removed = true;

        const index = transports.indexOf(entry);
        if (index !== -1) {
            transports.splice(index, 1);
        }

        unsubscribeInbound();
        transport.dispose?.();
        syncOutboundHook();
    };
};

/**
 * Removes all registered transports and cleans up.
 * Called automatically during `resetChannels()` via the `onReset` hook.
 * Can also be called directly for transport-only teardown.
 */
export const resetTransports = (): void => {
    const snapshot = [...transports];
    transports.splice(0, transports.length);

    for (const entry of snapshot) {
        entry.unsubscribeInbound();
        entry.transport.dispose?.();
    }

    syncOutboundHook();
};

// Auto-cleanup when resetChannels() is called.
onReset(resetTransports);
