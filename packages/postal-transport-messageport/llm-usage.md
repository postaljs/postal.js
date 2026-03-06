# postal-transport-messageport — LLM Usage Guide

npm: `postal-transport-messageport` | peer dep: `postal ^3.0.0`

---

## What This Package Does

Bridges postal pub/sub across execution boundaries that communicate via `MessagePort`. The primary use cases are iframes, dedicated Web Workers, and Node.js worker threads. Each pair of connected postal instances exchanges envelopes through a dedicated `MessagePort`.

A handshake (SYN/ACK over `postMessage`) establishes the port connection before any envelopes flow. This avoids the race condition where one side starts listening after the other has already sent.

The package has two entry points:

- `postal-transport-messageport` — browser APIs (iframes, web workers)
- `postal-transport-messageport/node` — Node.js `worker_threads` helpers + shared core

---

## When to Use This vs BroadcastChannel Transport

| Scenario                                 | Use                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| iframe ↔ parent window                   | `postal-transport-messageport`                                         |
| Dedicated Worker ↔ main thread (browser) | `postal-transport-messageport`                                         |
| Node.js worker_threads ↔ main thread     | `postal-transport-messageport/node`                                    |
| Same-origin tabs / windows               | `postal-transport-broadcastchannel`                                    |
| Cross-origin communication               | `postal-transport-messageport` (with `targetOrigin` / `allowedOrigin`) |

---

## All Exports

### Default entry point (`postal-transport-messageport`)

```ts
// High-level: iframes
connectToIframe(iframe: HTMLIFrameElement, options?: ConnectOptions): Promise<Transport>
connectToParent(options?: ConnectOptions): Promise<Transport>

// High-level: dedicated workers (browser)
connectToWorker(worker: Worker, options?: Pick<ConnectOptions, 'timeout'>): Promise<Transport>
connectToHost(options?: Pick<ConnectOptions, 'timeout'>): Promise<Transport>

// Low-level: raw MessagePort
createMessagePortTransport(port: MessagePort): Transport

// Transferables
markTransferable<T extends object>(payload: T, transferables: Transferable[]): T

// Error
PostalHandshakeTimeoutError  // Props: timeout (number)

// Types
ConnectOptions               // { timeout?, targetOrigin?, allowedOrigin? }

// Protocol constant
PROTOCOL_VERSION             // number, currently 1
```

### Node.js entry point (`postal-transport-messageport/node`)

```ts
// High-level: Node.js worker_threads
connectToWorkerThread(worker: Worker, options?: Pick<ConnectOptions, 'timeout'>): Promise<Transport>
connectFromWorkerThread(options?: Pick<ConnectOptions, 'timeout'>): Promise<Transport>

// Shared core (also available from default entry point)
createMessagePortTransport(port: MessagePort): Transport
markTransferable<T extends object>(payload: T, transferables: Transferable[]): T
PostalHandshakeTimeoutError
PROTOCOL_VERSION
ConnectOptions
```

The Node entry point deliberately excludes browser helpers (`connectToIframe`, `connectToParent`, `connectToWorker`, `connectToHost`) so Node-only codebases avoid importing browser globals.

---

## ConnectOptions

```ts
type ConnectOptions = {
    timeout?: number; // Handshake timeout in ms. Default: 5000
    targetOrigin?: string; // postMessage origin for connectToIframe(). Default: "*"
    allowedOrigin?: string; // Filter incoming SYN by origin for connectToParent(). Default: "*"
};
```

`connectToWorker` and `connectToHost` only accept `{ timeout? }` — `targetOrigin` / `allowedOrigin` don't apply to workers.

---

## Handshake Protocol

Both sides must participate for the connection to establish. If either side times out, it rejects with `PostalHandshakeTimeoutError`.

```
Initiator (parent / main thread)       Receiver (iframe / worker)
─────────────────────────────────────  ───────────────────────────────
new MessageChannel() → { port1, port2 }
postMessage({ type:"postal:syn" }, origin, [port2])
                                       receives "postal:syn" + port2
                                       port2.postMessage({ type:"postal:ack" })
port1 receives "postal:ack"
resolve(createMessagePortTransport(port1))
                                       resolve(createMessagePortTransport(port2))
```

All protocol messages are namespaced with `"postal:"` prefix to avoid collisions with other `postMessage` traffic on the same global or port.

---

## Common Patterns

### iframe bridge

```ts
// Parent window:
import { connectToIframe } from "postal-transport-messageport";
import { addTransport } from "postal";

const iframe = document.getElementById("my-iframe") as HTMLIFrameElement;

// Wait for iframe to load before connecting
iframe.addEventListener("load", async () => {
    const transport = await connectToIframe(iframe, {
        targetOrigin: "https://iframe.example.com",
        timeout: 5000,
    });
    addTransport(transport);
});
```

```ts
// Inside the iframe:
import { connectToParent } from "postal-transport-messageport";
import { addTransport } from "postal";

const transport = await connectToParent({
    allowedOrigin: "https://parent.example.com",
    timeout: 5000,
});
addTransport(transport);
```

After both sides call `addTransport()`, any `publish()` or `request()` on either bus flows to the other.

### Worker bridge

```ts
// Main thread:
import { connectToWorker } from "postal-transport-messageport";
import { addTransport } from "postal";

const worker = new Worker(new URL("./my-worker.ts", import.meta.url), { type: "module" });
const transport = await connectToWorker(worker, { timeout: 5000 });
addTransport(transport);
```

```ts
// my-worker.ts:
import { connectToHost } from 'postal-transport-messageport';
import { addTransport } from 'postal';

const transport = await connectToHost({ timeout: 5000 });
addTransport(transport);

// Now publish/subscribe work across the worker boundary
getChannel('tasks').subscribe('task.#', (envelope) => { ... });
```

### Node.js worker thread bridge

```ts
// Main thread:
import { Worker } from "node:worker_threads";
import { connectToWorkerThread } from "postal-transport-messageport/node";
import { addTransport } from "postal";

const worker = new Worker(new URL("./my-worker.js", import.meta.url));
const transport = await connectToWorkerThread(worker, { timeout: 5000 });
addTransport(transport);
```

```ts
// my-worker.js:
import { connectFromWorkerThread } from "postal-transport-messageport/node";
import { addTransport, getChannel } from "postal";

const transport = await connectFromWorkerThread({ timeout: 5000 });
addTransport(transport);

getChannel("compute").subscribe("task.#", (envelope) => { ... });
```

`connectFromWorkerThread()` listens on `parentPort` (from `node:worker_threads`). It rejects immediately if called outside a worker thread.

### Low-level: raw MessagePort

If you're managing `MessageChannel` / `MessagePort` yourself (e.g., for SharedWorker, custom protocol, or testing):

```ts
import { createMessagePortTransport } from "postal-transport-messageport";
import { addTransport } from "postal";

const { port1, port2 } = new MessageChannel();

// Side A:
addTransport(createMessagePortTransport(port1));

// Side B (pass port2 wherever needed):
addTransport(createMessagePortTransport(port2));
```

`createMessagePortTransport()` calls `port.start()` internally (idempotent), so you don't need to call it first.

### Handling connection failure

```ts
import { PostalHandshakeTimeoutError } from "postal-transport-messageport";

try {
    const transport = await connectToIframe(iframe, { timeout: 3000 });
    addTransport(transport);
} catch (err) {
    if (err instanceof PostalHandshakeTimeoutError) {
        console.error(`Handshake timed out after ${err.timeout}ms`);
    }
}
```

### Filtering what crosses the boundary

Use `addTransport()` options to restrict which channels or topics flow across:

```ts
addTransport(transport, {
    filter: {
        channels: ["orders", "inventory"],
        topics: ["item.*", "stock.#"],
    },
});
// Only envelopes matching both the channel list AND topic patterns are forwarded.
// Reply envelopes always bypass filters (required to complete RPC round-trips).
```

---

## Disposal and Cleanup

The transport's `dispose()` is called automatically when:

- The remove function returned by `addTransport()` is called
- `resetTransports()` is called
- `resetChannels()` is called

`dispose()` removes the message listener and closes the port (`port.close()`). After disposal, `send()` is a no-op and `subscribe()` returns a no-op unsubscribe.

---

## Non-Obvious Behavior

**Echo prevention is handled by postal core, not this package.** The `source` field on outbound envelopes contains the local `instanceId`. The inbound handler in `postal/transport.ts` drops envelopes where `source` matches the local instance.

**`connectToParent` / `connectToHost` listen on `globalThis`.** They add a `"message"` event listener to `globalThis` and remove it as soon as the SYN arrives (or on timeout). If multiple calls are made before any SYN arrives, only the first matching SYN is consumed.

**`targetOrigin: "*"` is the default but not recommended for production.** In production, pass the exact origin of the iframe to prevent message interception by a malicious page that could load in that iframe slot.

**The port is not started until `createMessagePortTransport()` is called.** The handshake functions use `port1.start()` during the ACK phase, but the transferred `port2` is started inside the transport factory.

**Protocol messages are wrapped in `{ type: "postal:envelope", envelope: ... }`.** Raw envelopes are never sent directly — they're always wrapped so postal messages can coexist with other postMessage traffic on the same port or window.

**`connectFromWorkerThread` uses `parentPort`, not `globalThis`.** In Node.js worker threads, the SYN arrives via the `parentPort` message channel (from `node:worker_threads`), not a `globalThis` message event. The handshake protocol is identical — only the plumbing differs.

**Node.js `MessagePort` is type-cast to DOM `MessagePort`.** Node's `MessagePort` has narrower TypeScript types (`onmessage`/`onmessageerror` are absent), but the runtime contract is identical. The implementation casts to DOM `MessagePort` for compatibility with `createMessagePortTransport()`.
