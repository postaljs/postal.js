# postal-transport-broadcastchannel

BroadcastChannel transport for [postal](https://github.com/postaljs/postal.js) — bridges pub/sub messaging across same-origin tabs, windows, and workers using the [BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel).

Any context that opens a channel with the same name is immediately in the mesh. No handshake, no setup dance.

## Install

```bash
npm install postal postal-transport-broadcastchannel
```

## Quick Start

```ts
// --- Tab A: publishing ---
import { getChannel, addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

const transport = createBroadcastChannelTransport();
addTransport(transport);

getChannel("orders").publish("item.placed", { sku: "HOVERBOARD-2015" });
```

```ts
// --- Tab B: subscribing ---
import { getChannel, addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

const transport = createBroadcastChannelTransport();
addTransport(transport);

getChannel("orders").subscribe("item.placed", envelope => {
    console.log(envelope.payload.sku); // "HOVERBOARD-2015"
});
```

That's it. Any tab with the same transport wired up hears the message.

## API

### `createBroadcastChannelTransport(name?): Transport`

Creates a postal `Transport` backed by a `BroadcastChannel`.

| Parameter | Type     | Default    | Description                                                                         |
| --------- | -------- | ---------- | ----------------------------------------------------------------------------------- |
| `name`    | `string` | `"postal"` | The `BroadcastChannel` name. All contexts using the same name are in the same mesh. |

Returns a `Transport` object with `send`, `subscribe`, and `dispose` methods, ready to pass to `addTransport()`.

```ts
import { addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

const transport = createBroadcastChannelTransport("my-app");
addTransport(transport);

// When you're done (e.g., on page unload):
transport.dispose();
```

## How It Works

The `BroadcastChannel` API is inherently pub/sub — any same-origin context that opens a channel with the same name receives every message posted to it. This transport wraps that primitive directly:

- When postal publishes an envelope, `send()` posts it to the channel as a namespaced `postal:envelope` message.
- Incoming messages are validated with `isEnvelopeMessage()` to ignore unrelated traffic sharing the channel name.
- Echo prevention (not receiving your own outbound messages) is handled by postal core, not by this transport. `BroadcastChannel` natively does not deliver a message to the sender, so this works out for free.

There is no handshake and no connection state. Open the channel, wire it up, you're live.

## Channel Name Isolation

Different channel names create completely isolated buses. Use this to run independent postal instances on the same origin without cross-contamination:

```ts
import { addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

// Tabs in the "checkout" flow only talk to each other
const checkoutTransport = createBroadcastChannelTransport("checkout");
addTransport(checkoutTransport);

// Tabs in the "admin" panel are completely separate
const adminTransport = createBroadcastChannelTransport("admin");
addTransport(adminTransport);
```

## Structured Clone

Data flows through `BroadcastChannel.postMessage()`, which uses [structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Envelope payloads can contain nested objects, arrays, `Date`s, `Map`s, `Set`s, `ArrayBuffer`s, etc. — but not functions, DOM nodes, or `Error` instances.

If you need to pass an `Error`, serialize it manually (e.g., `{ message: err.message, stack: err.stack }`) before publishing.

## BroadcastChannel vs. MessagePort

|              | BroadcastChannel         | MessagePort                                            |
| ------------ | ------------------------ | ------------------------------------------------------ |
| **Topology** | Many-to-many (all tabs)  | Point-to-point (specific target)                       |
| **Setup**    | No handshake             | Requires `connectTo*` / `connectFrom*`                 |
| **Scope**    | Same origin, any context | Explicit port transfer                                 |
| **Use when** | You want all tabs in     | You want a private pipe to a specific iframe or worker |

Use `postal-transport-broadcastchannel` when you want any tab that opts in to see messages. Use `postal-transport-messageport` when you need a dedicated, private channel to a specific iframe or worker.

## Debugging Exports

These are exported for version detection, diagnostics, and testing — you won't need them in normal use:

```ts
import { isEnvelopeMessage, PROTOCOL_VERSION } from "postal-transport-broadcastchannel";

// Check if a raw BroadcastChannel message is a postal envelope
channel.onmessage = event => {
    if (isEnvelopeMessage(event.data)) {
        console.log("postal envelope, protocol v" + PROTOCOL_VERSION, event.data.envelope);
    }
};
```

## License

MIT
