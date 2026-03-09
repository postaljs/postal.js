# postal-transport-serviceworker

[ServiceWorker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) transport for [postal](https://github.com/postaljs/postal.js) — lets a ServiceWorker participate in postal as a peer, not a router.

## What this does

Each tab opens a **dedicated MessagePort** to the controlling ServiceWorker. The SW gets one transport per connected client. This means:

- **Tab → SW**: any `publish()` on a tab is forwarded to the SW via its dedicated port
- **SW → Tab**: any `publish()` inside the SW is forwarded to all connected tabs (each via its own port)
- **Tab → Tab**: handled separately by [`postal-transport-broadcastchannel`](https://www.npmjs.com/package/postal-transport-broadcastchannel)

```
Tab A ──MessagePort──┐
                     SW (postal instance, one MessagePort transport per client)
Tab B ──MessagePort──┘

Tab A ──BroadcastChannel── Tab B   (handled by postal-transport-broadcastchannel)
```

No echo logic needed. Each MessagePort is point-to-point. BroadcastChannel excludes the sender by spec. The SW transport just participates.

## Installation

```bash
npm install postal postal-transport-serviceworker postal-transport-messageport
```

## Usage

### Client (page / tab)

```ts
import { getChannel } from "postal";
import { connectToServiceWorker } from "postal-transport-serviceworker";

await navigator.serviceWorker.register("/sw.js");
const registration = await navigator.serviceWorker.ready;

// Handshake with the SW, register a MessagePort transport
const removeTransport = await connectToServiceWorker(registration, {
    timeout: 5000, // handshake timeout (default 5000ms)
    onDisconnect: () => {
        // called when the SW is replaced (update/restart)
        console.log("SW disconnected — reconnect manually if needed");
    },
});

// Publish to the SW
getChannel("notifications").publish("push.received", { title: "Hello" });

// Clean up
removeTransport();
```

### ServiceWorker (`sw.js`)

The SW-side API lives in a separate entry point so client bundles don't pull in `ServiceWorkerGlobalScope` types.

```ts
import { addTransport, getChannel } from "postal";
import { listenForClients } from "postal-transport-serviceworker/sw";

// Accept connections from all tabs
const { dispose } = listenForClients({
    filter: { channels: ["notifications"] }, // optional
});

// Subscribe to messages from tabs
getChannel("notifications").subscribe("push.received", data => {
    console.log("SW received push:", data);
    // Fan out to all connected tabs via postal's transport layer
    getChannel("notifications").publish("push.displayed", data);
});

// Recommended: claim clients immediately after activation
self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});
```

## API

### `connectToServiceWorker(registration, options?)`

**Tab-side.** Initiates a MessagePort handshake with the controlling ServiceWorker, wraps the resulting port in a transport, and registers it with postal via `addTransport()`.

Returns `Promise<() => void>` — the remove function from `addTransport()`. Call it to disconnect and clean up.

Throws `PostalSwNotActiveError` if `registration.active` is null (SW not yet active).
Rejects with `PostalSwHandshakeTimeoutError` if the SW doesn't ack within the timeout.

| Option         | Type         | Default | Description                                               |
| -------------- | ------------ | ------- | --------------------------------------------------------- |
| `timeout`      | `number`     | `5000`  | Handshake timeout in milliseconds                         |
| `onDisconnect` | `() => void` | —       | Called when the SW controller changes (SW restart/update) |

### `listenForClients(options?)`

**SW-side.** Installs a `message` listener on the SW global and accepts incoming handshakes from tabs. Returns `{ dispose }`.

`dispose()` removes the listener and cleans up all active connections.

| Option   | Type              | Default | Description                             |
| -------- | ----------------- | ------- | --------------------------------------- |
| `filter` | `TransportFilter` | —       | Filter applied to each client transport |

### Errors

- `PostalSwHandshakeTimeoutError` — handshake timed out. Has a `timeout: number` field.
- `PostalSwNotActiveError` — `registration.active` was null when `connectToServiceWorker` was called.

### `PROTOCOL_VERSION`

Current handshake protocol version. Namespaced to `"postal:sw-"` to avoid collisions with the generic MessagePort protocol.

## SW Lifecycle

The ServiceWorker can be terminated and restarted by the browser at any time.

- **On SW restart**: the old MessagePort is dead. Use the `onDisconnect` callback to reconnect.
- **On SW update**: `controllerchange` fires. `onDisconnect` is called. Reconnect manually or prompt the user to reload.
- **SW side**: the `message` listener is re-installed on every SW activation. Old ports from the previous SW lifecycle are already dead — stale ports just close.

## Combining with BroadcastChannel transport

These two transports are complementary and can run on the same postal instance simultaneously:

```ts
import { getChannel, addTransport } from "postal";
import { createBroadcastChannelTransport } from "postal-transport-broadcastchannel";
import { connectToServiceWorker } from "postal-transport-serviceworker";

// Tab-to-tab (fast, no SW roundtrip)
const removeBc = addTransport(createBroadcastChannelTransport("my-app"));

// Tab-to-SW (for push notifications, background sync, etc.)
const registration = await navigator.serviceWorker.ready;
const removeSw = await connectToServiceWorker(registration);
```

## Known Limitations

- **HTTPS required**: Service Workers only run on secure origins (`https://` or `localhost`).
- **Active SW required**: `connectToServiceWorker()` requires `registration.active` to be non-null. Wait for the SW to activate (e.g., `navigator.serviceWorker.ready`) before calling it.
