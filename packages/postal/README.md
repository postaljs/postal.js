# postal

Pub/Sub message bus for JavaScript and TypeScript. Wildcard subscriptions, channel-scoped messaging, and zero dependencies.

## Install

```bash
npm install postal
# or
pnpm add postal
# or
yarn add postal
```

## Quick Start

```ts
import { getChannel } from "postal";

const orders = getChannel("orders");

// Subscribe
const unsub = orders.subscribe("item.placed", envelope => {
    console.log(envelope.payload); // { sku: "HOVERBOARD-2015", qty: 1 }
});

// Publish
orders.publish("item.placed", { sku: "HOVERBOARD-2015", qty: 1 });

// Unsubscribe
unsub();
```

## Wildcard Subscriptions

Topics are dot-delimited strings. Two wildcards are supported:

- `*` — matches exactly one segment
- `#` — matches zero or more segments

```ts
const events = getChannel("events");

// Matches "user.created", "user.deleted", "user.updated"
events.subscribe("user.*", envelope => {
    console.log(envelope.topic); // e.g. "user.created"
});

// Matches "order.item.placed", "order.item.cancelled", "order.refund.issued", etc.
events.subscribe("order.#", envelope => {
    console.log(envelope.topic);
});

events.publish("user.created", { id: 42 });
events.publish("order.item.placed", { sku: "DeLorean" });
```

## Typed Channels

Two ways to get full payload type inference on your channels.

### Explicit type map

Pass your topic map as a generic to `getChannel`:

```ts
type OrderTopicMap = {
    "item.placed": { sku: string; qty: number };
    "item.cancelled": { sku: string; reason: string };
};

const orders = getChannel<OrderTopicMap>("orders");

// payload is typed as { sku: string; qty: number }
orders.subscribe("item.placed", envelope => {
    console.log(envelope.payload.sku);
});

// TypeScript error — "item.shipped" isn't in the topic map
orders.publish("item.shipped", { sku: "X" });
```

### Registry augmentation

If many files share the same channel, declare the map once via module augmentation and skip the generic at every call site:

```ts
// types/postal.d.ts (or anywhere in your project)
import "postal";

declare module "postal" {
    interface ChannelRegistry {
        orders: {
            "item.placed": { sku: string; qty: number };
            "item.cancelled": { sku: string; reason: string };
        };
    }
}
```

```ts
import { getChannel } from "postal";

const orders = getChannel("orders"); // topic map inferred from registry

orders.subscribe("item.placed", envelope => {
    console.log(envelope.payload.sku); // typed!
});
```

Both approaches produce the same typed `Channel`. Channels not in the registry (and without an explicit type map) fall back to `Record<string, unknown>` — no typing required to get started.

## Request / Handle (RPC)

Channels support a correlation-based request/response pattern. The requester gets a `Promise`; the handler's return value resolves it.

Mark topics as RPC by giving them a `{ request, response }` shape in the registry:

```ts
declare module "postal" {
    interface ChannelRegistry {
        compute: {
            "fibonacci.calculate": {
                request: { n: number };
                response: { result: number };
            };
        };
    }
}
```

```ts
import { getChannel, PostalTimeoutError, PostalRpcError } from "postal";

const compute = getChannel("compute");

// Register a handler (one per topic per channel)
const unhandle = compute.handle("fibonacci.calculate", envelope => {
    const { n } = envelope.payload;
    return { result: fibonacci(n) };
});

// Send a request
try {
    const { result } = await compute.request("fibonacci.calculate", { n: 10 });
    console.log(result); // 55
} catch (err) {
    if (err instanceof PostalTimeoutError) {
        console.error(`Timed out after ${err.timeout}ms`);
    } else if (err instanceof PostalRpcError) {
        console.error(`Handler threw: ${err.message}`);
    }
}

// Remove the handler
unhandle();
```

Handlers can be async. The default timeout is 5000ms; pass `{ timeout: ms }` as a third argument to `request()` to override it.

## Wire Taps

Wiretaps observe every envelope flowing through the bus — local publishes, requests, and inbound messages from transports. Useful for logging, debugging, and analytics.

```ts
import { addWiretap } from "postal";

const removeWiretap = addWiretap(envelope => {
    console.log(`[${envelope.channel}] ${envelope.topic}`, envelope.payload);
});

// Errors thrown by wiretaps are silently swallowed — they never affect dispatch.

// Remove when done
removeWiretap();
```

## Transports

Transports bridge postal across execution contexts — iframes, web workers, and browser tabs. Register a transport and messages flow transparently between contexts, as if everything were on the same bus.

```ts
import { addTransport } from "postal";

// Optionally filter which channels cross the boundary
addTransport(transport, { filter: { channels: ["orders", "notifications"] } });
```

Available transport packages:

- **[postal-transport-messageport](https://www.npmjs.com/package/postal-transport-messageport)** — iframes and web workers via the Channel Messaging API
- **[postal-transport-broadcastchannel](https://www.npmjs.com/package/postal-transport-broadcastchannel)** — cross-tab messaging via the BroadcastChannel API

## API

| Export                              | Description                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| `getChannel(name)`                  | Get or create a singleton channel by name                            |
| `addWiretap(callback)`              | Register a global observer for all envelopes                         |
| `addTransport(transport, options?)` | Register a transport to bridge messages across contexts              |
| `resetChannels()`                   | Dispose all channels and clear all state — useful for test isolation |
| `resetWiretaps()`                   | Remove all registered wiretaps                                       |
| `resetTransports()`                 | Remove all registered transports                                     |
| `PostalTimeoutError`                | Thrown when a `request()` call exceeds its timeout                   |
| `PostalRpcError`                    | Thrown when an RPC handler throws — relayed back to the requester    |
| `PostalDisposedError`               | Thrown when calling methods on a disposed channel                    |

## Documentation

Full documentation, guides, and examples at **[postal-js.org](https://postal-js.org)**.

## License

MIT
