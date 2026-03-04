# postal-transport-broadcastchannel — LLM Usage Guide

npm: `postal-transport-broadcastchannel` | peer dep: `postal ^3.0.0`

---

## What This Package Does

Bridges postal pub/sub across same-origin tabs and windows using the browser's `BroadcastChannel` API. Every context that calls `createBroadcastChannelTransport()` with the same channel name joins the same mesh automatically.

No handshake required. No async setup. Open the channel, register the transport, done.

---

## When to Use This vs MessagePort Transport

| Scenario                       | Use                                 |
| ------------------------------ | ----------------------------------- |
| Same-origin tabs / windows     | `postal-transport-broadcastchannel` |
| iframe ↔ parent window         | `postal-transport-messageport`      |
| Dedicated Worker ↔ main thread | `postal-transport-messageport`      |
| Cross-origin communication     | `postal-transport-messageport`      |

BroadcastChannel is same-origin only — the browser enforces this. Cross-origin messaging requires MessagePort with explicit origin restrictions.

---

## Exports

```ts
createBroadcastChannelTransport(name?: string): Transport
// name defaults to "postal"

// Protocol types (for debugging / testing)
isEnvelopeMessage(data: unknown): data is EnvelopeMessage
PROTOCOL_VERSION: number  // currently 1
type EnvelopeMessage = { type: "postal:envelope"; version: number; envelope: Envelope }
```

That's it. One function is the entire user-facing API.

---

## Usage

### Basic: connect all same-origin tabs

Call this once per tab/window at startup:

```ts
import { addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";

addTransport(createBroadcastChannelTransport());
// All tabs running this code can now pub/sub across each other.
```

### Custom channel name

Use a custom name to isolate multiple postal instances at the same origin:

```ts
// Tab in "admin" context:
addTransport(createBroadcastChannelTransport("postal:admin"));

// Tab in "customer" context:
addTransport(createBroadcastChannelTransport("postal:customer"));

// These two meshes are isolated — messages don't cross between them.
```

### Filtering what crosses tabs

Use `addTransport()` options to restrict which envelopes cross the boundary:

```ts
addTransport(createBroadcastChannelTransport(), {
    filter: {
        channels: ["notifications", "session"],
        topics: ["user.#"],
    },
});
// Only envelopes on the listed channels matching the topic patterns are forwarded.
// Reply envelopes always bypass filters.
```

### Cleanup

```ts
const removeTransport = addTransport(createBroadcastChannelTransport());

// When done (e.g., component unmount, logout):
removeTransport();
// This calls transport.dispose(), which closes the BroadcastChannel.
```

`resetChannels()` also disposes all transports automatically — no manual cleanup needed in tests.

---

## Echo Prevention

BroadcastChannel sends to all contexts on the same channel name — including the sending tab itself in some implementations, but more commonly it does not echo to the sender. Regardless, postal's transport layer handles this explicitly:

- Every outbound envelope is stamped with `source: instanceId` before being sent via the transport.
- The inbound handler drops any envelope where `envelope.source === localInstanceId`.

This means: a message published on Tab A arrives at Tab B and Tab C but not back at Tab A, even if the underlying BroadcastChannel implementation would normally reflect it.

---

## Wire Format

Messages sent over BroadcastChannel are wrapped:

```json
{
    "type": "postal:envelope",
    "version": 1,
    "envelope": {
        "id": "...",
        "type": "publish",
        "channel": "...",
        "topic": "...",
        "payload": {},
        "timestamp": 0,
        "source": "..."
    }
}
```

The `postal:` prefix is used so postal messages can coexist with other BroadcastChannel users on the same channel name. Non-postal messages are ignored by `isEnvelopeMessage()`.

---

## Non-Obvious Behavior

**BroadcastChannel is same-origin only.** If you need cross-origin messaging, use `postal-transport-messageport` instead.

**No handshake means no connection state.** There's no way to know how many other tabs are in the mesh, or even if any are. If no other tab is listening, published messages are silently dropped — normal BroadcastChannel behavior.

**RPC across tabs works but requires a handler in another tab.** `request()` publishes a request envelope which crosses to other tabs. If a `handle()` exists in another tab, it picks it up and sends the reply back. The reply crosses back and resolves the promise. This works correctly — echo prevention doesn't interfere with replies because reply envelopes target the system channel by `correlationId`, not the originating instance.

**Closing the transport closes the underlying `BroadcastChannel`.** After `dispose()`, the transport is silent — `send()` is a no-op, no more inbound messages are delivered.

**Multiple transports on the same name are valid but redundant.** If you call `createBroadcastChannelTransport()` twice with the same name in the same tab and register both, every outbound message is sent twice and every inbound message is received twice (the second delivery is dropped by echo prevention on the inbound path). Don't do this — one transport per tab per channel name.
