/**
 * Channel creation, pub/sub dispatch, request/handle RPC, and singleton registry.
 *
 * A channel is a named scope for messages. Subscribers register topic
 * patterns (with optional `*` and `#` wildcards), and publishes fan out
 * to every subscriber whose pattern matches the published topic.
 *
 * Channels also support request/handle — a correlation-based RPC pattern
 * where `request()` publishes a message through the channel and returns a
 * Promise, and `handle()` registers a specialized subscriber whose return
 * value is published as a reply on the internal system channel, resolving
 * the requester's Promise.
 *
 * Channels are singletons — `getChannel("orders")` always returns the
 * same instance. The registry is module-level and can be reset for testing.
 * @module
 */

import { matchTopic, type PayloadFor } from "./topicMatch";
import { createEnvelope, type Envelope } from "./envelope";

/**
 * Augmentable interface for global channel type registration.
 *
 * Users can declare their channel maps once via module augmentation
 * and get automatic payload inference on `getChannel()` without
 * passing a generic at every call site:
 *
 * ```ts
 * declare module 'postal' {
 *   interface ChannelRegistry {
 *     orders: { 'item.placed': { sku: string } };
 *   }
 * }
 *
 * const orders = getChannel('orders'); // Channel<{ 'item.placed': { sku: string } }>
 * ```
 *
 * Channels not in the registry fall back to `Record<string, unknown>` (untyped).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ChannelRegistry {}

/** Resolves the TMap for a channel name — registry lookup with untyped fallback. */
type ResolveChannelMap<TName extends string> = TName extends keyof ChannelRegistry
    ? ChannelRegistry[TName]
    : Record<string, unknown>;

// --- Type-level RPC utilities ---

/** Detects whether a map entry is RPC-shaped ({ request, response }). */
type IsRpcTopic<T> = T extends { request: unknown; response: unknown } ? true : false;

/**
 * Extracts pub/sub-only topic keys from a channel map.
 * For untyped maps (Record<string, unknown>), resolves to `string` so all topics are publishable.
 */
type PubSubTopics<TMap> = string extends keyof TMap
    ? string
    : { [K in keyof TMap]: IsRpcTopic<TMap[K]> extends true ? never : K }[keyof TMap];

/**
 * Extracts RPC-capable topic keys from a channel map.
 * For untyped maps (Record<string, unknown>), resolves to `string` so all topics are requestable.
 */
type RpcTopics<TMap> = string extends keyof TMap
    ? string
    : { [K in keyof TMap]: IsRpcTopic<TMap[K]> extends true ? K : never }[keyof TMap];

/** Extracts the request payload type from an RPC map entry. Falls back to T for non-RPC entries. */
type RequestPayload<T> = T extends { request: infer R } ? R : T;

/** Extracts the response type from an RPC map entry. Falls back to unknown for non-RPC entries. */
type ResponsePayload<T> = T extends { response: infer S } ? S : unknown;

/**
 * Unwraps RPC map entries to their request payload for subscriber type inference.
 * When a subscriber matches an RPC topic, they receive the request payload
 * (not the { request; response } map entry), because that's what flows on the channel.
 * Distributes over unions, so wildcard matches spanning both pub/sub and RPC topics work.
 */
type SubscribePayloadFor<T> = T extends { request: infer R } ? R : T;

/** In-flight RPC response wrapper. Unpacked before resolving the caller's promise. */
type RpcResponse<T = unknown> =
    | { success: true; payload: T }
    | { success: false; payload: { message: string; code?: string } };

/** Pending RPC entry in the correlation registry. */
type PendingRequest = {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
    onSettled?: () => void;
};

/** Default timeout for `request()` in milliseconds. */
const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

/**
 * Thrown when a `request()` call exceeds its timeout without receiving a response.
 *
 * Exposes `channel`, `topic`, and `timeout` so callers can inspect what timed out.
 */
export class PostalTimeoutError extends Error {
    readonly channel: string;
    readonly topic: string;
    readonly timeout: number;

    constructor(channel: string, topic: string, timeout: number) {
        super(`Request to "${channel}/${topic}" timed out after ${timeout}ms`);
        this.name = "PostalTimeoutError";
        this.channel = channel;
        this.topic = topic;
        this.timeout = timeout;
    }
}

/**
 * Thrown when an RPC handler throws and the error is relayed back to the requester.
 *
 * The original error's message is preserved. An optional `code` provides
 * machine-readable error classification for both in-memory and remote handlers.
 */
export class PostalRpcError extends Error {
    readonly code?: string;

    constructor(message: string, code?: string) {
        super(message);
        this.name = "PostalRpcError";
        if (code !== undefined) {
            this.code = code;
        }
    }
}

/**
 * Thrown when calling any method on a channel that has been disposed.
 *
 * Exposes the `channel` name so callers can identify which disposed
 * channel they're holding a stale reference to.
 */
export class PostalDisposedError extends Error {
    readonly channel: string;

    constructor(channel: string) {
        super(`Channel "${channel}" has been disposed`);
        this.name = "PostalDisposedError";
        this.channel = channel;
    }
}

/** Options for `channel.request()`. */
export type RequestOptions = {
    /** Timeout in milliseconds. Defaults to 5000. */
    timeout?: number;
};

/** Callback signature for message subscribers. Receives the full envelope. */
export type SubscriberCallback<TPayload = unknown> = (envelope: Envelope<TPayload>) => void;

/** Internal record tracking a single subscription. */
type SubscriberRecord = {
    pattern: string;
    callback: SubscriberCallback<never>;
};

/**
 * A named, typed message channel.
 *
 * The optional `TMap` generic maps topic strings to their payload types.
 * Pub/sub topics use plain payload types. RPC topics use `{ request: X; response: Y }`.
 *
 * - `publish()` only accepts pub/sub topics (RPC topics excluded at compile time)
 * - `request()` and `handle()` only accept RPC topics
 * - `subscribe()` accepts any topic — RPC topics deliver the request payload
 *
 * Without a `TMap`, all payloads fall back to `unknown` and all methods accept any topic.
 */
export type Channel<TMap extends Record<string, unknown> = Record<string, unknown>> = {
    /** The channel's name, as provided at creation time. Readable after dispose. */
    readonly name: string;

    /**
     * Tear down this channel.
     *
     * Clears all subscribers and handlers, rejects pending RPC promises with
     * `PostalDisposedError`, and removes this channel from the singleton registry.
     * After disposal, calling `subscribe`, `publish`, `request`, or `handle`
     * throws `PostalDisposedError`.
     *
     * Idempotent — calling dispose() on an already-disposed channel is a no-op.
     * Unsubscribe/unhandle functions returned before disposal become silent no-ops.
     */
    dispose: () => void;

    /**
     * Subscribe to messages matching a topic pattern.
     *
     * The pattern can be an exact topic string or include AMQP-style
     * wildcards (`*` for one segment, `#` for zero or more).
     *
     * @param pattern - Exact topic or wildcard pattern
     * @param callback - Called with the full envelope for each matching publish or request
     * @returns Unsubscribe function — safe to call multiple times
     * @throws PostalDisposedError if the channel has been disposed
     */
    subscribe: <TPattern extends string>(
        pattern: TPattern,
        callback: SubscriberCallback<SubscribePayloadFor<PayloadFor<TMap, TPattern>>>
    ) => () => void;

    /**
     * Publish a message to all subscribers whose patterns match the topic.
     *
     * Creates one envelope and delivers it to every matching subscriber.
     * Subscribers run independently — if any throw, the rest still execute.
     * Errors are collected and re-thrown as a single `AggregateError` after
     * all subscribers have been called.
     *
     * RPC-shaped topics are excluded at compile time — use `request()` instead.
     *
     * @param topic - Exact topic string (no wildcards, no RPC topics)
     * @param payload - Message payload, type-checked against TMap when provided
     * @throws PostalDisposedError if the channel has been disposed
     */
    publish: <TTopic extends string & PubSubTopics<TMap>>(
        topic: TTopic,
        payload: TMap[TTopic]
    ) => void;

    /**
     * Send a request and await a response from a registered handler.
     *
     * Creates a request envelope and publishes it through the channel like any
     * other message. Regular subscribers see the request. A registered handler
     * (via `handle()`) processes it and publishes a reply on the internal system
     * channel. The reply resolves this Promise.
     *
     * Rejects with `PostalTimeoutError` if no response arrives in time.
     * Rejects with `PostalRpcError` if the handler throws.
     *
     * @param topic - Exact topic string (must be an RPC-shaped topic in typed channels)
     * @param payload - Request payload, extracted from the RPC map entry
     * @param options - Request options (timeout, etc.)
     * @returns Promise resolving with the handler's response
     * @throws PostalDisposedError if the channel has been disposed
     */
    request: <TTopic extends string & RpcTopics<TMap>>(
        topic: TTopic,
        payload: RequestPayload<TMap[TTopic]>,
        options?: RequestOptions
    ) => Promise<ResponsePayload<TMap[TTopic]>>;

    /**
     * Register a responder for a request topic.
     *
     * The handler is registered as a specialized subscriber that only fires for
     * `type: "request"` envelopes. Its return value (sync or async) is wrapped
     * in a reply envelope and published on the internal system channel.
     *
     * If the handler throws, the error is wrapped in a `PostalRpcError` and
     * relayed to the requester.
     *
     * Only one handler per topic per channel — registering a second handler
     * for the same topic throws immediately.
     *
     * @param topic - Exact topic string (must be an RPC-shaped topic in typed channels)
     * @param callback - Receives the request envelope, returns the response
     * @returns Unhandle function — removes the handler, safe to call multiple times
     * @throws PostalDisposedError if the channel has been disposed
     */
    handle: <TTopic extends string & RpcTopics<TMap>>(
        topic: TTopic,
        callback: (
            envelope: Envelope<RequestPayload<TMap[TTopic]>>
        ) => ResponsePayload<TMap[TTopic]> | Promise<ResponsePayload<TMap[TTopic]>>
    ) => () => void;
};

/**
 * Extended channel type with internal dispatch method.
 * Not exported — used only for the system channel to deliver pre-built
 * reply envelopes without going through publish()'s envelope creation.
 */
type InternalChannel = Channel & {
    dispatch: (envelope: Envelope) => void;
};

// --- Module-level RPC state ---

/** Unique identifier for this postal instance. Used as the reply topic suffix. */
let instanceId = crypto.randomUUID();

/**
 * Returns the current postal instance identifier.
 * Used by the transport layer to stamp outbound envelopes with their origin.
 * @internal
 */
export const getInstanceId = (): string => instanceId;

/** Pending RPC promises keyed by correlationId. */
let pendingRequests = new Map<string, PendingRequest>();

/** The internal system channel for RPC reply traffic. Not in the public registry. */
let systemChannel: InternalChannel;

/** Unsubscribe function for the standing RPC reply subscription. */
let systemUnsub: (() => void) | null = null;

// --- Outbound hook (transport integration) ---

/** Called after every locally-originated dispatch so transports can broadcast. */
let outboundHook: ((envelope: Envelope) => void) | null = null;

/**
 * Registers a callback that fires after every locally-originated dispatch.
 * Only one hook can be active — subsequent calls replace the previous.
 * Pass `null` to clear.
 * @internal Used by the transport layer.
 */
export const setOutboundHook = (hook: ((envelope: Envelope) => void) | null): void => {
    outboundHook = hook;
};

// --- Wiretap (global bus observers) ---

/** Registered wiretap callbacks. Cleared on resetChannels(). */
const wiretaps: ((envelope: Envelope) => void)[] = [];

/** Notify all wiretaps. Errors are swallowed — observers must never affect dispatch. */
const notifyWiretaps = (envelope: Envelope): void => {
    for (const tap of wiretaps) {
        try {
            tap(envelope);
        } catch {
            // Wiretaps are passive observers.
        }
    }
};

/**
 * Registers a global observer that sees every envelope flowing through the bus.
 *
 * Wiretaps fire for local publishes, requests, handler replies, and inbound
 * envelopes arriving from transports. Errors thrown by wiretaps are silently
 * swallowed — they must never affect message dispatch.
 *
 * @param callback - Called with the full envelope for every message
 * @returns Unsubscribe function (idempotent)
 */
export const addWiretap = (callback: (envelope: Envelope) => void): (() => void) => {
    wiretaps.push(callback);

    let removed = false;

    return () => {
        if (removed) {
            return;
        }
        removed = true;

        const index = wiretaps.indexOf(callback);
        if (index !== -1) {
            wiretaps.splice(index, 1);
        }
    };
};

/**
 * Removes all registered wiretaps.
 * Also called automatically during `resetChannels()`.
 */
export const resetWiretaps = (): void => {
    wiretaps.splice(0, wiretaps.length);
};

// --- Reset hook (transport cleanup integration) ---

/** Callbacks to invoke when resetChannels() is called. Persistent across resets. */
const resetCallbacks: (() => void)[] = [];

/**
 * Registers a callback to run during resetChannels().
 * Returns a function that removes the callback.
 * @internal Used by the transport layer for cleanup.
 */
export const onReset = (callback: () => void): (() => void) => {
    resetCallbacks.push(callback);
    return () => {
        const index = resetCallbacks.indexOf(callback);
        if (index !== -1) {
            resetCallbacks.splice(index, 1);
        }
    };
};

/**
 * Creates a new Channel instance.
 *
 * For singleton behavior (recommended), use `getChannel()` instead.
 * Not part of the public API — use `resetChannels()` for test isolation.
 *
 * @internal
 * @param name - The channel name
 * @returns A new Channel instance with no subscribers
 */
export const createChannel = <TMap extends Record<string, unknown> = Record<string, unknown>>(
    name: string
): Channel<TMap> => {
    const subscribers: SubscriberRecord[] = [];
    let disposed = false;

    const ensureNotDisposed = (): void => {
        if (disposed) {
            throw new PostalDisposedError(name);
        }
    };

    // Tracks correlation IDs from this channel's request() calls.
    // Used during dispose to reject only this channel's pending RPCs.
    const pendingCorrelationIds = new Set<string>();

    // Shared dispatch core — delivers a pre-built envelope to matching subscribers.
    // Returns collected errors so callers can decide how to handle them.
    const dispatchEnvelope = (envelope: Envelope): unknown[] => {
        const errors: unknown[] = [];

        // Snapshot prevents mutation during iteration (e.g., unsubscribe-during-publish).
        const snapshot = [...subscribers];

        for (const sub of snapshot) {
            if (matchTopic(sub.pattern, envelope.topic)) {
                try {
                    sub.callback(envelope as Envelope<never>);
                } catch (err) {
                    errors.push(err);
                }
            }
        }

        return errors;
    };

    const subscribe = <TPattern extends string>(
        pattern: TPattern,
        callback: SubscriberCallback<SubscribePayloadFor<PayloadFor<TMap, TPattern>>>
    ): (() => void) => {
        ensureNotDisposed();
        const record: SubscriberRecord = {
            pattern,
            // The cast is safe — SubscriberRecord uses `never` as the payload type
            // so it can hold callbacks of any payload type in the same array.
            // The actual type safety comes from the Channel<TMap> generic on subscribe().
            callback: callback as SubscriberCallback<never>,
        };
        subscribers.push(record);

        // Unsubscribe by identity reference. indexOf returns -1 for an
        // already-removed record, so calling this multiple times is a no-op.
        return () => {
            const index = subscribers.indexOf(record);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
        };
    };

    const publish = <TTopic extends string & PubSubTopics<TMap>>(
        topic: TTopic,
        payload: TMap[TTopic]
    ): void => {
        ensureNotDisposed();
        const envelope = createEnvelope({
            type: "publish",
            channel: name,
            topic,
            payload,
        });

        const errors = dispatchEnvelope(envelope);
        outboundHook?.(envelope);
        notifyWiretaps(envelope);

        if (errors.length > 0) {
            throw new AggregateError(
                errors,
                `${errors.length} subscriber(s) threw during publish to "${name}/${topic}"`
            );
        }
    };

    // --- Request / Handle ---

    // Tracks which topics have handlers registered. Enforces one handler per topic.
    // The actual dispatch happens through the subscriber list via the wrapped callback.
    const handlerTopics = new Set<string>();

    const handle = <TTopic extends string & RpcTopics<TMap>>(
        topic: TTopic,
        callback: (
            envelope: Envelope<RequestPayload<TMap[TTopic]>>
        ) => ResponsePayload<TMap[TTopic]> | Promise<ResponsePayload<TMap[TTopic]>>
    ): (() => void) => {
        ensureNotDisposed();
        if (handlerTopics.has(topic)) {
            throw new Error(`Handler already registered for "${topic}" on channel "${name}"`);
        }

        handlerTopics.add(topic);

        // Wrap the handler as a subscriber that only fires for request envelopes,
        // captures the return value, and publishes a reply on the system channel.
        const wrappedCallback: SubscriberCallback<never> = (envelope: Envelope<never>) => {
            if (envelope.type !== "request") {
                return;
            }

            const replyTo = envelope.replyTo;
            const correlationId = envelope.correlationId;

            if (!replyTo || !correlationId) {
                return;
            }

            // Async IIFE — the handler may be sync or async, so we normalize.
            // Errors are caught and published as RPC error responses rather than thrown.
            (async () => {
                try {
                    const result = await (callback as (envelope: Envelope<never>) => unknown)(
                        envelope
                    );

                    const replyEnvelope = createEnvelope({
                        type: "reply" as const,
                        channel: "__postal__.system",
                        topic: replyTo,
                        payload: { success: true, payload: result } as RpcResponse,
                        correlationId,
                    });

                    systemChannel.dispatch(replyEnvelope);
                    outboundHook?.(replyEnvelope);
                    notifyWiretaps(replyEnvelope);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    const code = (err as { code?: string })?.code;

                    const errorPayload: RpcResponse = {
                        success: false,
                        payload: code !== undefined ? { message, code } : { message },
                    };

                    const errorEnvelope = createEnvelope({
                        type: "reply" as const,
                        channel: "__postal__.system",
                        topic: replyTo,
                        payload: errorPayload,
                        correlationId,
                    });

                    systemChannel.dispatch(errorEnvelope);
                    outboundHook?.(errorEnvelope);
                    notifyWiretaps(errorEnvelope);
                }
            })();
        };

        const record: SubscriberRecord = { pattern: topic, callback: wrappedCallback };
        subscribers.push(record);

        // Safe to call multiple times — delete/indexOf on missing entries are no-ops.
        return () => {
            handlerTopics.delete(topic);
            const index = subscribers.indexOf(record);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
        };
    };

    const request = <TTopic extends string & RpcTopics<TMap>>(
        topic: TTopic,
        payload: RequestPayload<TMap[TTopic]>,
        options: RequestOptions = {}
    ): Promise<ResponsePayload<TMap[TTopic]>> => {
        ensureNotDisposed();
        const { timeout = DEFAULT_REQUEST_TIMEOUT_MS } = options;

        const correlationId = crypto.randomUUID();
        pendingCorrelationIds.add(correlationId);

        const envelope = createEnvelope({
            type: "request",
            channel: name,
            topic,
            payload,
            replyTo: `system.rpc.response.${instanceId}`,
            correlationId,
        });

        return new Promise<ResponsePayload<TMap[TTopic]>>((resolve, reject) => {
            const timer = setTimeout(() => {
                pendingCorrelationIds.delete(correlationId);
                pendingRequests.delete(correlationId);
                reject(new PostalTimeoutError(name, topic, timeout));
            }, timeout);

            pendingRequests.set(correlationId, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timer,
                onSettled: () => pendingCorrelationIds.delete(correlationId),
            });

            // Dispatch through the channel's subscriber list — regular subscribers
            // AND the handler subscriber both see this envelope. Subscriber errors
            // are collected but don't affect the RPC flow (the handler's reply is
            // what resolves/rejects the promise).
            dispatchEnvelope(envelope);
            outboundHook?.(envelope);
            notifyWiretaps(envelope);
        });
    };

    const dispose = (): void => {
        if (disposed) {
            return;
        }
        disposed = true;

        // Reject any pending RPC promises originating from this channel.
        for (const correlationId of pendingCorrelationIds) {
            const pending = pendingRequests.get(correlationId);
            if (pending) {
                clearTimeout(pending.timer);
                pendingRequests.delete(correlationId);
                pending.reject(new PostalDisposedError(name));
            }
        }
        pendingCorrelationIds.clear();

        subscribers.splice(0, subscribers.length);
        handlerTopics.clear();

        // Remove from the singleton registry if present.
        // No-op for channels created directly via createChannel().
        channels.delete(name);
    };

    // Internal dispatch — delivers a pre-built envelope to matching subscribers.
    // Used by the system channel for RPC replies. Not exposed on the Channel type.
    const dispatch = (envelope: Envelope): void => {
        dispatchEnvelope(envelope);
    };

    // Extra `dispatch` and `dispose` properties are structurally invisible to
    // the Channel<TMap> return type except for `dispose` which is declared.
    // `dispatch` is accessible via InternalChannel for the system channel.
    const channel = { name, dispose, subscribe, publish, request, handle, dispatch };
    return channel;
};

// --- System Channel Initialization ---

/**
 * Initializes (or re-initializes) the internal system channel for RPC reply traffic.
 * Called eagerly at module load and again after resetChannels().
 */
const initSystemChannel = (): void => {
    // Cast is safe — createChannel() returns dispatch alongside other methods,
    // but the Channel type doesn't declare it. InternalChannel adds it back.
    systemChannel = createChannel("__postal__.system") as unknown as InternalChannel;

    systemUnsub = systemChannel.subscribe(
        `system.rpc.response.${instanceId}`,
        (envelope: Envelope) => {
            const correlationId = envelope.correlationId;
            if (!correlationId) {
                return;
            }

            const pending = pendingRequests.get(correlationId);
            if (!pending) {
                // Reply for a request we don't know about — could be a duplicate
                // or from a stale handler after reset. Safe to ignore.
                return;
            }

            clearTimeout(pending.timer);
            pending.onSettled?.();
            pendingRequests.delete(correlationId);

            const response = envelope.payload as RpcResponse;
            if (response.success) {
                pending.resolve(response.payload);
            } else {
                pending.reject(new PostalRpcError(response.payload.message, response.payload.code));
            }
        }
    );
};

// Eager initialization — transports and cross-boundary audit subscriptions
// need the system channel to exist before any RPC call happens.
initSystemChannel();

// --- Channel Registry (singleton management) ---

/** Module-level channel registry. Keyed by channel name. */
const channels = new Map<string, Channel>();

/**
 * Gets or creates a singleton channel by name.
 *
 * The first call with a given name creates the channel. Subsequent calls
 * return the same instance. The type map generic is compile-time only —
 * all call sites referencing the same channel name should use the same map.
 *
 * Two ways to type a channel:
 *
 * 1. **Explicit type map** — pass `TMap` directly:
 *    ```ts
 *    const ch = getChannel<MyTopicMap>("orders");
 *    ```
 *
 * 2. **Registry augmentation** — declare once, infer everywhere:
 *    ```ts
 *    declare module "postal" {
 *      interface ChannelRegistry { orders: MyTopicMap }
 *    }
 *    const ch = getChannel("orders"); // MyTopicMap inferred
 *    ```
 *
 * @param name - The channel name (defaults to `"__default__"`)
 * @returns The singleton channel instance
 */
export function getChannel<TMap extends Record<string, unknown>>(name: string): Channel<TMap>;
export function getChannel<TName extends string = "__default__">(
    name?: TName
): Channel<ResolveChannelMap<TName>>;
export function getChannel(name: string = "__default__"): Channel {
    let channel = channels.get(name);
    if (!channel) {
        channel = createChannel(name);
        channels.set(name, channel);
    }
    return channel;
}

/**
 * Dispatches an externally-received envelope into the local bus.
 *
 * Routes by envelope type:
 * - `"reply"` → system channel (RPC reply resolution)
 * - `"publish"` / `"request"` → named channel in the registry
 *
 * Does NOT trigger the outbound hook — inbound envelopes stay local.
 * If the target channel doesn't exist locally, the envelope is silently dropped.
 *
 * @internal Used by the transport layer.
 */
export const dispatchInbound = (envelope: Envelope): void => {
    if (envelope.type === "reply") {
        systemChannel.dispatch(envelope);
        return;
    }

    const channel = channels.get(envelope.channel) as InternalChannel | undefined;
    if (channel) {
        channel.dispatch(envelope);
    }

    notifyWiretaps(envelope);
};

/**
 * Clears the channel registry and all RPC state. Primarily useful for test isolation.
 *
 * Rejects pending RPC promises, tears down the system channel, regenerates the
 * instance GUID, and re-initializes a fresh system channel.
 */
export const resetChannels = (): void => {
    // Notify reset listeners (e.g., transport layer cleanup) before
    // tearing down channels they might reference.
    // Snapshot prevents issues if a callback modifies the list during iteration.
    const callbacks = [...resetCallbacks];
    for (const cb of callbacks) {
        cb();
    }
    outboundHook = null;
    wiretaps.splice(0, wiretaps.length);

    // Dispose each channel so stale references throw PostalDisposedError
    // instead of silently working as detached orphans.
    for (const channel of channels.values()) {
        channel.dispose();
    }
    channels.clear();

    // Safety sweep — reject any pending RPCs not owned by a registered channel.
    // Shouldn't happen in practice, but prevents callers from hanging forever.
    for (const [, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Channel registry reset while RPC request was pending"));
    }
    pendingRequests = new Map();

    // Tear down the old system channel subscription
    if (systemUnsub) {
        systemUnsub();
        systemUnsub = null;
    }

    // Regenerate instance GUID so stale in-flight replies addressed
    // to the old GUID are ignored by the new system channel.
    instanceId = crypto.randomUUID();

    // Re-initialize with the new GUID — system channel always exists.
    initSystemChannel();
};
