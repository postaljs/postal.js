# postal — LLM Usage Guide

npm: `postal` | version: 3.0.0 | zero runtime dependencies

---

## What This Package Is

The core pub/sub message bus. Everything else in the ecosystem is an addon. This package provides:

- Named channels with AMQP-style wildcard topic matching
- Request/handle RPC with correlation, timeouts, and error propagation
- Global wiretap observers
- A transport integration layer for bridging across execution boundaries
- Full TypeScript inference including wildcard subscription payloads

---

## Public API

```ts
// Functions
getChannel(name: string): Channel<TMap>
addWiretap(callback: (envelope: Envelope) => void): () => void
resetWiretaps(): void
addTransport(transport: Transport, options?: TransportOptions): () => void
resetTransports(): void
resetChannels(): void   // primary test-isolation tool

// Channel<TMap> type
{
  readonly name: string;
  subscribe(pattern, callback): () => void;
  publish(topic, payload): void;
  request(topic, payload, options?): Promise<Response>;
  handle(topic, callback): () => void;
  dispose(): void;
}

// Error classes
PostalTimeoutError    // request() exceeded timeout. Props: channel, topic, timeout
PostalRpcError        // handler threw, error relayed to caller. Props: code?
PostalDisposedError   // method called on disposed channel. Props: channel

// Key types
Envelope<TPayload>    // { id, type, channel, topic, payload, timestamp, source?, replyTo?, correlationId? }
EnvelopeType          // "publish" | "request" | "reply"
Channel<TMap>
ChannelRegistry       // augmentable interface
RequestOptions        // { timeout?: number }
SubscriberCallback<T> // (envelope: Envelope<T>) => void
Transport             // { send, subscribe, dispose? }
TransportFilter       // { channels?, topics? }
TransportOptions      // { filter? }
```

---

## TypeScript Patterns

### ChannelRegistry Module Augmentation

Declare your channel maps in a `.d.ts` or any `.ts` file. Applies globally.

```ts
declare module "postal" {
    interface ChannelRegistry {
        orders: {
            "item.placed": { sku: string; qty: number };
            "item.cancelled": { sku: string; reason: string };
            "item.shipped": { sku: string; trackingId: string };
        };
    }
}
```

After this, `getChannel('orders')` returns a fully typed `Channel`. No generics needed at the call site.

### RPC Topics

Declare an RPC topic by giving it a `{ request: X; response: Y }` shape:

```ts
declare module "postal" {
    interface ChannelRegistry {
        pricing: {
            "quote.calculate": {
                request: { sku: string; qty: number };
                response: { price: number };
            };
        };
    }
}
```

- `publish('quote.calculate', ...)` — compile error (use `request()` instead)
- `request('quote.calculate', { sku: 'A', qty: 1 })` — returns `Promise<{ price: number }>`
- `handle('quote.calculate', async (env) => ({ price: 42 }))` — types the callback
- `subscribe('quote.calculate', ...)` — allowed; delivers the request payload, not the RPC map entry

### Wildcard Payload Inference

`subscribe()` infers the callback payload type automatically:

```ts
// Given the orders channel above:
getChannel("orders").subscribe("item.*", envelope => {
    // envelope.payload: { sku, qty } | { sku, reason } | { sku, trackingId }
});
```

`PayloadFor<TMap, Pattern>` is the utility type driving this. It handles:

- Exact key → specific type
- `prefix.*` → single-segment children union
- `prefix.#` → prefix + all descendants union
- `#` → all values union
- `*` → single-segment keys only
- Complex patterns → all values union (safe fallback)

---

## Common Usage Patterns

### Basic pub/sub

```ts
import { getChannel } from "postal";

const orders = getChannel("orders");

const unsub = orders.subscribe("item.placed", envelope => {
    console.log(envelope.payload.sku, envelope.payload.qty);
});

orders.publish("item.placed", { sku: "ABC-123", qty: 2 });

// Clean up:
unsub();
```

### Wildcard subscriptions

```ts
// Match any single segment after "item."
getChannel("orders").subscribe("item.*", handler);

// Match "item" and anything after it (zero or more segments)
getChannel("orders").subscribe("item.#", handler);

// Match all messages on the channel
getChannel("orders").subscribe("#", handler);
```

### RPC request/handle

```ts
// Register a handler (typically at startup)
const unhandle = getChannel("pricing").handle("quote.calculate", async envelope => {
    const { sku, qty } = envelope.payload;
    const price = await fetchPrice(sku, qty);
    return { price };
});

// Make a request anywhere
try {
    const result = await getChannel("pricing").request(
        "quote.calculate",
        { sku: "ABC", qty: 10 },
        { timeout: 3000 }
    );
    console.log(result.price);
} catch (err) {
    if (err instanceof PostalTimeoutError) {
        /* no handler responded */
    }
    if (err instanceof PostalRpcError) {
        /* handler threw */
    }
}
```

### Wiretap (global observer)

```ts
import { addWiretap } from "postal";

const removeWiretap = addWiretap(envelope => {
    console.log(`[${envelope.channel}] ${envelope.topic}`, envelope.payload);
});

// Wiretap errors are silently swallowed — they never affect message delivery.
// Remove when done:
removeWiretap();
```

### Dispose a channel

```ts
const ch = getChannel("session");
ch.subscribe("user.login", handler);

// On logout / cleanup:
ch.dispose();
// - Clears all subscribers
// - Rejects any pending RPCs with PostalDisposedError
// - Removes from singleton registry
// - Subsequent calls throw PostalDisposedError

// Get a fresh instance:
const freshCh = getChannel("session"); // creates new
```

---

## Gotchas and Non-Obvious Behavior

**Channels are singletons.** `getChannel('orders')` always returns the same object until it's disposed or `resetChannels()` is called. TMap consistency across call sites is the caller's responsibility — the type is compile-time only.

**publish() errors are AggregateError.** If any subscriber throws, postal collects all errors and re-throws as `AggregateError` after all subscribers have been called. One bad subscriber doesn't stop others.

**request() subscribers and handlers both see the envelope.** A regular `subscribe()` on the same topic as a `handle()` will also receive `type: "request"` envelopes. This is intentional — you can log or audit requests via subscribe.

**One handler per topic per channel.** Registering a second `handle()` for the same topic throws a plain `Error` immediately. Not a `PostalError` subclass — just `Error`.

**handle() errors become PostalRpcError on the caller.** If a handler throws, the error message is captured, wrapped in `{ success: false, payload: { message, code? } }`, and delivered as a `PostalRpcError` to the requester. The `.code` property propagates if the original error had a `.code`.

**dispose() on an already-disposed channel is a no-op.** Idempotent. Unsubscribe functions returned before disposal also become silent no-ops.

**resetChannels() regenerates the instanceId.** Any in-flight RPC replies from before the reset are addressed to the old instanceId topic and will be silently dropped by the new system channel. This is intentional.

**Wiretap errors are swallowed.** A throwing wiretap will not affect message delivery or other wiretaps.

**The system channel is internal.** `__postal__.system` is not in the public registry and cannot be retrieved via `getChannel()`. It carries RPC reply traffic only.

**transports are cleaned up by resetChannels().** You don't need to call `resetTransports()` separately before `resetChannels()` in tests.

---

## Test Isolation

```ts
import { resetChannels } from "postal";

afterEach(() => {
    resetChannels();
    // Disposes all channels, rejects pending RPCs, removes transports and wiretaps,
    // regenerates instanceId. Clean slate for the next test.
});
```
