# postal

Pub/Sub message bus for JavaScript and TypeScript.

<!-- badges -->

## Features

- **TypeScript-first** — full type inference on channels, topics, and message data
- **AMQP-style wildcards** — `*` matches a single topic segment, `#` matches zero or more
- **Channel-scoped messaging** — isolate message domains with named channels
- **Request/handle RPC** — built-in request/response pattern
- **Wire taps** — global observers that see every message on the bus
- **Transport system** — bridge pub/sub across iframes, workers, and browser tabs
- **Zero dependencies** — no lodash, no nothing

## Install

```bash
npm install postal
```

## Quick Example

```ts
import { getChannel } from "postal";

const orders = getChannel("orders");

orders.subscribe("order.created", envelope => {
    console.log("New order:", envelope.payload.orderId);
});

orders.publish("order.created", { orderId: "abc-123" });
```

For the full API — wildcards, RPC, wire taps, transports — see the [docs](https://postal-js.org).

> **Upgrading from v2?** postal v3 is a ground-up rewrite with breaking changes to the module system, subscriber callbacks, envelope shape, and more. See the [v2 → v3 migration guide](https://postal-js.org/migration/v2-to-v3/) before upgrading.

## Packages

| Package                                                                          | npm                                 | Description                                        |
| -------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| [postal](packages/postal/)                                                       | `postal`                            | Core message bus                                   |
| [postal-transport-messageport](packages/postal-transport-messageport/)           | `postal-transport-messageport`      | MessagePort transport for iframes and workers      |
| [postal-transport-broadcastchannel](packages/postal-transport-broadcastchannel/) | `postal-transport-broadcastchannel` | BroadcastChannel transport for cross-tab messaging |

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm lint          # Lint all packages
pnpm run checks    # lint + test + build (CI gate)
```

## License

MIT
