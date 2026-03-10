# postal — LLM Reference

This file gives AI coding assistants the context they need to work with this codebase effectively. It is not user documentation.

---

## Monorepo Structure

```
postal/
  packages/
    postal/                            # Core library. npm: "postal"
    postal-transport-messageport/      # MessagePort transport. npm: "postal-transport-messageport"
    postal-transport-broadcastchannel/ # BroadcastChannel transport. npm: "postal-transport-broadcastchannel"
    postal-transport-serviceworker/    # ServiceWorker transport. npm: "postal-transport-serviceworker"
    postal-transport-childprocess/     # child_process/cluster IPC transport. npm: "postal-transport-childprocess"
    docs/                              # Starlight docs site. private, not published.
  archive/                             # Legacy v2.x code. Read-only reference.
  pnpm-workspace.yaml                  # Workspace config
  turbo.json                           # Turborepo pipeline config
```

Each package has its own `tsconfig.json`, `jest.config.js`, `tsdown.config.ts`, and ESLint config. Transport packages list `postal` as a peer dependency and use `postal: workspace:*` as a dev dependency.

---

## Package Relationships

```
postal-transport-messageport      ──┐
                                    │
postal-transport-broadcastchannel ──┤
                                    ├──▶  postal (peer dep)
postal-transport-serviceworker    ──┤
                                    │
postal-transport-childprocess     ──┘

@postal/docs ──▶ (standalone Astro/Starlight site, no runtime dep on postal)
```

Transports are always installed alongside `postal`. They import types and internal hooks (`addTransport`, `Transport`, `Envelope`) from `postal` at build time and at runtime.

---

## Key Files

### postal/src/

| File            | Purpose                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `index.ts`      | Public exports only — no logic                                                                 |
| `channel.ts`    | All channel logic: singleton registry, pub/sub dispatch, RPC, dispose, wiretaps, outbound hook |
| `envelope.ts`   | `Envelope` type and `createEnvelope()` factory                                                 |
| `transport.ts`  | `addTransport()`, `resetTransports()`, filter logic, echo prevention wiring                    |
| `topicMatch.ts` | AMQP wildcard matching + `PayloadFor<TMap, Pattern>` type utility                              |

### postal-transport-messageport/src/

| File                      | Purpose                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `index.ts`                | Public exports (browser entry point)                                             |
| `node.ts`                 | Public exports (Node.js entry point — `postal-transport-messageport/node`)       |
| `messagePortTransport.ts` | `createMessagePortTransport(port)` — low-level wrapper                           |
| `iframe.ts`               | `connectToIframe()` / `connectToParent()` — handshake for iframes                |
| `worker.ts`               | `connectToWorker()` / `connectToHost()` — handshake for browser workers          |
| `worker-thread.ts`        | `connectToWorkerThread()` / `connectFromWorkerThread()` — Node.js worker_threads |
| `transferables.ts`        | `markTransferable()` — zero-copy ArrayBuffer transfer support                    |
| `protocol.ts`             | Message shapes, type guards, factories. SYN/ACK/Envelope types                   |
| `types.ts`                | `ConnectOptions` type                                                            |
| `errors.ts`               | `PostalHandshakeTimeoutError`                                                    |

### postal-transport-broadcastchannel/src/

| File                           | Purpose                                                              |
| ------------------------------ | -------------------------------------------------------------------- |
| `index.ts`                     | Public exports only                                                  |
| `broadcastChannelTransport.ts` | `createBroadcastChannelTransport(name?)`                             |
| `protocol.ts`                  | `EnvelopeMessage` type, `isEnvelopeMessage`, `createEnvelopeMessage` |

### postal-transport-serviceworker/src/

| File                 | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `index.ts`           | Client-side public exports (`connectToServiceWorker`, errors, types, `PROTOCOL_VERSION`) |
| `sw.ts`              | SW-side public exports (`listenForClients`, errors, types, `PROTOCOL_VERSION`)           |
| `clientTransport.ts` | `connectToServiceWorker(registration, options?)` — tab-side handshake + transport wiring |
| `swTransport.ts`     | `listenForClients(options?)` — SW-side listener, one transport per connected client      |
| `protocol.ts`        | Message shapes, type guards, factories. SW-namespaced SYN/ACK types                      |
| `errors.ts`          | `PostalSwHandshakeTimeoutError`, `PostalSwNotActiveError`                                |
| `types.ts`           | `ClientConnectOptions`, `SwListenOptions`                                                |

### postal-transport-childprocess/src/

| File                | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `index.ts`          | Public exports — `connectToChild`, `connectToParent`, `createIPCTransport`, errors |
| `cluster.ts`        | Cluster entry point — `connectToClusterWorker`, `connectToClusterPrimary`          |
| `child.ts`          | `connectToChild(child, options?)` / `connectToParent(options?)` — fork IPC helpers |
| `clusterHelpers.ts` | `connectToClusterWorker(worker, options?)` / `connectToClusterPrimary(options?)`   |
| `ipcTransport.ts`   | `createIPCTransport(endpoint)` — low-level transport for any IPC-compatible object |
| `protocol.ts`       | Message shapes, type guards, factories. SYN/ACK types for IPC handshake            |
| `errors.ts`         | `PostalHandshakeTimeoutError`                                                      |
| `types.ts`          | `ConnectOptions`                                                                   |

---

## Core API (postal)

### getChannel

```ts
getChannel<TMap>(name: string): Channel<TMap>           // explicit type map
getChannel<TName>(name?: TName): Channel<ResolveChannelMap<TName>>  // registry-resolved
```

Singleton registry — same name always returns the same instance. Two ways to type a channel:

1. **Explicit type map** — `getChannel<MyTopicMap>("orders")` passes the map directly.
2. **Registry augmentation** — declare a `ChannelRegistry` entry and `getChannel("orders")` resolves `TMap` automatically.

Channels without either fall back to `Record<string, unknown>`.

### Channel methods

```ts
channel.subscribe(pattern, callback) => () => void
channel.publish(topic, payload) => void
channel.request(topic, payload, options?) => Promise<Response>
channel.handle(topic, callback) => () => void
channel.dispose() => void
channel.name  // readonly string
```

- `subscribe`: pattern can include `*` (one segment) or `#` (zero or more). Returns unsubscribe fn, safe to call multiple times.
- `publish`: fans out to all matching subscribers. All run; errors collected as `AggregateError`.
- `request`: sends an envelope with `type: "request"`, returns a Promise resolved by a `handle()` responder. Rejects with `PostalTimeoutError` (default 5s) or `PostalRpcError` if the handler throws.
- `handle`: registers one responder per topic. Throws immediately if a handler is already registered for that topic. Handler return value (sync or async) becomes the response.
- `dispose`: rejects pending RPCs with `PostalDisposedError`, clears subscribers, removes from registry. Idempotent.

### Wiretaps

```ts
addWiretap(callback: (envelope: Envelope) => void): () => void
resetWiretaps(): void
```

Wiretaps see every envelope: local publishes, requests, handler replies, and inbound envelopes from transports. Errors thrown in wiretaps are swallowed — they never affect dispatch.

### Transports

```ts
addTransport(transport: Transport, options?: TransportOptions): () => void
resetTransports(): void
```

`Transport` interface:

```ts
type Transport = {
    send: (envelope: Envelope) => void;
    subscribe: (callback: (envelope: Envelope) => void) => () => void;
    dispose?: () => void;
};
```

`TransportFilter`:

```ts
type TransportFilter = {
    channels?: string[]; // exact channel name match
    topics?: string[]; // AMQP wildcard pattern match
};
```

Reply envelopes always bypass filters to complete RPC round-trips.

### Reset (for tests)

```ts
resetChannels(): void  // disposes all channels, rejects pending RPCs, clears transports and wiretaps
resetTransports(): void
resetWiretaps(): void
```

`resetChannels()` calls `resetTransports()` automatically via an internal hook. Call it in `afterEach` for test isolation.

---

## Type System Patterns

### Explicit type map

Pass the topic map as a generic — no module augmentation needed:

```ts
type OrderTopicMap = {
    "item.placed": { sku: string; qty: number };
    "item.cancelled": { sku: string; reason: string };
};

const orders = getChannel<OrderTopicMap>("orders");
// publish, subscribe, request, handle are all typed
```

### ChannelRegistry augmentation

For channels shared across many files, declare the map once via module augmentation:

```ts
declare module "postal" {
    interface ChannelRegistry {
        orders: {
            "item.placed": { sku: string; qty: number };
            "item.cancelled": { sku: string; reason: string };
        };
        pricing: {
            "quote.calculate": { request: { sku: string }; response: { price: number } };
        };
    }
}
```

After augmentation:

- `getChannel('orders')` returns `Channel<{ 'item.placed': ..., 'item.cancelled': ... }>` — no generic needed
- `getChannel('pricing')` returns a channel where `publish('quote.calculate', ...)` is a compile error (RPC topic) and `request('quote.calculate', ...)` is required
- Unknown channel names fall back to `Channel<Record<string, unknown>>`

### RPC topic shape

A topic is RPC-shaped if its value type is `{ request: X; response: Y }`.

- `publish()` excludes RPC topics at compile time
- `request()` and `handle()` only accept RPC topics
- `subscribe()` accepts any topic; RPC topics deliver the `request` payload to the callback

### PayloadFor<TMap, Pattern>

Used internally by `subscribe()` to infer the callback payload type for wildcard patterns:

```ts
// Given: { 'order.placed': A; 'order.cancelled': B }
PayloadFor<TMap, "order.*">; // A | B
PayloadFor<TMap, "order.#">; // A | B (+ 'order' itself if it's a key)
PayloadFor<TMap, "#">; // A | B (all values)
PayloadFor<TMap, "*">; // single-segment keys only
// Complex patterns fall back to union of all values
```

---

## Envelope Structure

Every message, regardless of type, is an `Envelope`:

```ts
type Envelope<TPayload = unknown> = {
    id: string; // UUID v4, unique per message
    type: "publish" | "request" | "reply";
    channel: string;
    topic: string;
    payload: TPayload;
    timestamp: number; // Date.now()
    source?: string; // instanceId, stamped by transport layer on outbound
    replyTo?: string; // present on 'request' envelopes
    correlationId?: string; // present on 'reply' envelopes
};
```

`source` is how echo prevention works — the transport layer stamps it, the inbound handler drops envelopes where `source === localInstanceId`.

---

## RPC Internals (non-obvious details)

- There is an internal `__postal__.system` channel that is NOT in the public registry. It carries reply envelopes.
- Each postal instance has a UUID (`instanceId`). Reply topics are `system.rpc.response.${instanceId}`.
- `request()` creates a `correlationId`, stores a pending promise, dispatches the request envelope normally (regular subscribers AND the handler both see it), and waits.
- The handler wraps its return in `{ success: true, payload }` or `{ success: false, payload: { message, code? } }` and dispatches to the system channel.
- `resetChannels()` regenerates the instanceId so stale in-flight replies from before the reset are ignored.
- Only one handler per topic per channel. Registering a second throws immediately (not a PostalError, a plain Error).

---

## Echo Prevention

When a transport is registered, every locally-originated envelope is stamped with `source: instanceId` before being sent via the transport. When an inbound envelope arrives from a transport, the inbound handler checks `envelope.source === getInstanceId()` and drops it if true.

This means a tab publishing to BroadcastChannel will not receive its own messages back, even though BroadcastChannel normally sends to all contexts on the same channel name.

---

## Testing Patterns

- Tests live in `*.test.ts` alongside source files.
- Always call `resetChannels()` in `afterEach` to prevent state leakage between tests.
- For transport tests, create the transport, register it, exercise behavior, then `resetChannels()`.
- `PostalHandshakeTimeoutError`, `PostalTimeoutError`, `PostalRpcError`, `PostalDisposedError` are all inspectable — check `.message`, `.name`, and type-specific properties (`.timeout`, `.code`, `.channel`).
- No `.tsx` files in this repo — all source is `.ts`.
- Jest with ts-jest. No Babel. TypeScript is transpiled directly.

---

## Common Tasks

### Add a subscription

```ts
import { getChannel } from "postal";

const unsub = getChannel("my-channel").subscribe("topic.*", envelope => {
    console.log(envelope.payload);
});
// later:
unsub();
```

### Publish a message

```ts
getChannel("my-channel").publish("topic.created", { id: "123" });
```

### RPC request/handle

```ts
// Handler side:
const unhandle = getChannel("pricing").handle("quote.calculate", async envelope => {
    return { price: computePrice(envelope.payload.sku) };
});

// Requester side:
const result = await getChannel("pricing").request("quote.calculate", { sku: "ABC" });
// result: { price: number }
```

### Bridge across tabs (BroadcastChannel)

```ts
import { addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

const removeTransport = addTransport(createBroadcastChannelTransport());
// All tabs that do the same are now in a mesh.
```

### Bridge to an iframe

```ts
// Parent:
import { connectToIframe } from "postal-transport-messageport";
import { addTransport } from "postal";

const transport = await connectToIframe(iframeEl, { targetOrigin: "https://example.com" });
addTransport(transport);

// Inside iframe:
import { connectToParent } from "postal-transport-messageport";
import { addTransport } from "postal";

const transport = await connectToParent({ allowedOrigin: "https://parent.com" });
addTransport(transport);
```

### Bridge to a worker (browser)

```ts
// Main thread:
import { connectToWorker } from "postal-transport-messageport";
import { addTransport } from "postal";

const transport = await connectToWorker(new Worker("./worker.js"));
addTransport(transport);

// Inside worker:
import { connectToHost } from "postal-transport-messageport";
import { addTransport } from "postal";

const transport = await connectToHost();
addTransport(transport);
```

### Bridge to a worker thread (Node.js)

```ts
// Main thread:
import { Worker } from "node:worker_threads";
import { connectToWorkerThread } from "postal-transport-messageport/node";
import { addTransport } from "postal";

const transport = await connectToWorkerThread(new Worker("./worker.js"));
addTransport(transport);

// Inside worker thread:
import { connectFromWorkerThread } from "postal-transport-messageport/node";
import { addTransport } from "postal";

const transport = await connectFromWorkerThread();
addTransport(transport);
```

### Bridge to a ServiceWorker

```ts
// Tab side:
import { getChannel, addTransport } from "postal";
import { connectToServiceWorker } from "postal-transport-serviceworker";

const registration = await navigator.serviceWorker.ready;
const removeTransport = await connectToServiceWorker(registration, {
    timeout: 5000,
    onDisconnect: () => reconnect(),
});

// SW side (sw.js):
import { addTransport, getChannel } from "postal";
import { listenForClients } from "postal-transport-serviceworker/sw";

const { dispose } = listenForClients({ filter: { channels: ["notifications"] } });
```

### Bridge to a child_process

```ts
// Parent:
import { fork } from "child_process";
import { addTransport } from "postal";
import { connectToChild } from "postal-transport-childprocess";

const child = fork("./worker.js");
const transport = await connectToChild(child);
const remove = addTransport(transport);
child.on("exit", () => remove());

// Child (worker.js):
import { addTransport } from "postal";
import { connectToParent } from "postal-transport-childprocess";

const transport = await connectToParent();
addTransport(transport);
```

### Bridge to a cluster worker

```ts
// Primary:
import cluster from "cluster";
import { addTransport } from "postal";
import { connectToClusterWorker } from "postal-transport-childprocess/cluster";

const worker = cluster.fork();
const transport = await connectToClusterWorker(worker);
const remove = addTransport(transport);
worker.on("exit", () => remove());

// Worker:
import { addTransport } from "postal";
import { connectToClusterPrimary } from "postal-transport-childprocess/cluster";

const transport = await connectToClusterPrimary();
addTransport(transport);
```

### Add a wiretap (global bus logger)

```ts
import { addWiretap } from "postal";

const removeWiretap = addWiretap(envelope => {
    console.log("[postal]", envelope.channel, envelope.topic, envelope.payload);
});
```

---

## Code Style Constraints

- Curly braces on all conditionals, even single-line.
- Strict equality (`===`, `!==`) only.
- Arrow functions. No `function` keyword in new code.
- Zero runtime dependencies. Do not add any.
- ESM imports. Library ships CJS + ESM via tsdown.
- Comments explain WHY, not WHAT.
