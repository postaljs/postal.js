# postal-transport-messageport

MessagePort transport for [postal](https://github.com/postaljs/postal.js) — bridges pub/sub messaging across iframes, web workers, and Node.js worker threads using the [Channel Messaging API](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API).

Each transport wraps a dedicated `MessagePort`, giving you a private communication pipe that doesn't interfere with other `postMessage` traffic on the window or worker.

## Install

```bash
npm install postal postal-transport-messageport
```

## Quick Start

### Iframe

```ts
// --- Parent window ---
import { getChannel, addTransport } from "postal";
import { connectToIframe } from "postal-transport-messageport";

const iframe = document.querySelector("iframe");
const transport = await connectToIframe(iframe);
addTransport(transport);

// Messages now flow to/from the iframe
getChannel("orders").publish("item.placed", { sku: "HOVERBOARD-2015" });
```

```ts
// --- Inside the iframe ---
import { getChannel, addTransport } from "postal";
import { connectToParent } from "postal-transport-messageport";

const transport = await connectToParent();
addTransport(transport);

// Subscribes see messages from the parent (and vice versa)
getChannel("orders").subscribe("item.placed", envelope => {
    console.log(envelope.payload.sku); // "HOVERBOARD-2015"
});
```

### Web Worker

```ts
// --- Main thread ---
import { getChannel, addTransport } from "postal";
import { connectToWorker } from "postal-transport-messageport";

const worker = new Worker("worker.js");
const transport = await connectToWorker(worker);
addTransport(transport);

const result = await getChannel("compute").request("crunch.numbers", { n: 1000 });
```

```ts
// --- worker.js ---
import { getChannel, addTransport } from "postal";
import { connectToHost } from "postal-transport-messageport";

const transport = await connectToHost();
addTransport(transport);

getChannel("compute").handle("crunch.numbers", ({ n }) => {
    return { result: fibonacci(n) };
});
```

### Node.js Worker Thread

Node.js helpers are a separate import to avoid pulling in browser globals:

```ts
// --- Main thread ---
import { Worker } from "node:worker_threads";
import { getChannel, addTransport } from "postal";
import { connectToWorkerThread } from "postal-transport-messageport/node";

const worker = new Worker("./worker.js");
const transport = await connectToWorkerThread(worker);
addTransport(transport);

const result = await getChannel("compute").request("crunch.numbers", { n: 1000 });
```

```ts
// --- worker.js ---
import { getChannel, addTransport } from "postal";
import { connectFromWorkerThread } from "postal-transport-messageport/node";

const transport = await connectFromWorkerThread();
addTransport(transport);

getChannel("compute").handle("crunch.numbers", ({ n }) => {
    return { result: fibonacci(n) };
});
```

## API

### `createMessagePortTransport(port: MessagePort): Transport`

Low-level. Wraps an already-connected `MessagePort` into a postal `Transport`. Use this when you're managing the `MessageChannel` and port transfer yourself.

```ts
// A MessageChannel creates a linked pair: port1 <-> port2
const channel = new MessageChannel();

// Send port2 to the remote side (via postMessage, worker, etc.)
// The remote wraps port2: createMessagePortTransport(receivedPort)
remoteTarget.postMessage("here's your port", [channel.port2]);

// Locally, wrap port1 — the end YOU kept
const transport = createMessagePortTransport(channel.port1);
addTransport(transport);
```

### `connectToIframe(iframe, options?): Promise<Transport>`

Called from the **parent** window. Creates a `MessageChannel`, transfers one port to the iframe via `postMessage`, and waits for an acknowledgment. The iframe must call `connectToParent()`.

### `connectToParent(options?): Promise<Transport>`

Called from **inside the iframe**. Listens for the handshake initiated by the parent, acknowledges it, and resolves with a transport.

### `connectToWorker(worker, options?): Promise<Transport>`

Called from the **main thread**. Same handshake pattern as iframes, but targets a dedicated `Worker`. The worker must call `connectToHost()`.

### `connectToHost(options?): Promise<Transport>`

Called from **inside the worker**. Listens for the handshake from the main thread, acknowledges it, and resolves with a transport.

### `connectToWorkerThread(worker, options?): Promise<Transport>`

> Import from `postal-transport-messageport/node`

Called from the **main thread** to connect to a postal instance in a Node.js `worker_threads` Worker. Creates a `MessageChannel`, transfers one port to the worker, and waits for an acknowledgment. The worker must call `connectFromWorkerThread()`.

### `connectFromWorkerThread(options?): Promise<Transport>`

> Import from `postal-transport-messageport/node`

Called from **inside a worker thread**. Listens on `parentPort` for the handshake initiated by the main thread, acknowledges it, and resolves with a transport. Rejects immediately if called outside a worker thread (i.e. `parentPort` is `null`).

### Options

```ts
type ConnectOptions = {
    timeout?: number; // Handshake timeout in ms (default: 5000)
    targetOrigin?: string; // postMessage target origin — connectToIframe only (default: "*")
    allowedOrigin?: string; // Expected SYN source origin — connectToParent only (default: "*")
};
```

`connectToWorker`, `connectToHost`, `connectToWorkerThread`, and `connectFromWorkerThread` only accept `timeout` (workers have no origin concept).

## How It Works

1. The initiator (`connectToIframe` / `connectToWorker` / `connectToWorkerThread`) creates a `MessageChannel` and sends a `postal:syn` message to the target, transferring `port2`.
2. The receiver (`connectToParent` / `connectToHost` / `connectFromWorkerThread`) picks up the SYN and the transferred port, then sends a `postal:ack` back through the port.
3. The initiator receives the ACK and both sides wrap their port in `createMessagePortTransport()`.
4. From here, envelopes flow as `postal:envelope` messages on the private port. No more traffic on the shared `window.message` event or `parentPort`.

All protocol messages are namespaced with `postal:` to avoid collisions with other `postMessage` users.

## Multiple Connections

Each `MessageChannel` is point-to-point. If you have 3 iframes and a worker, that's 4 transports:

```ts
const [t1, t2, t3, t4] = await Promise.all([
    connectToIframe(iframe1),
    connectToIframe(iframe2),
    connectToIframe(iframe3),
    connectToWorker(worker),
]);

addTransport(t1);
addTransport(t2);
addTransport(t3, { filter: { channels: ["compute"] } }); // Only forward compute messages
addTransport(t4);
```

Messages between iframe1 and iframe2 hop through the parent's bus — the parent is the hub.

Same pattern works in Node.js with worker threads:

```ts
import { Worker } from "node:worker_threads";
import { connectToWorkerThread } from "postal-transport-messageport/node";

const [t1, t2] = await Promise.all([
    connectToWorkerThread(new Worker("./compute.js")),
    connectToWorkerThread(new Worker("./io.js")),
]);

addTransport(t1, { filter: { channels: ["compute"] } });
addTransport(t2, { filter: { channels: ["io"] } });
```

## Security

In production, always set explicit origins:

```ts
// Parent
const transport = await connectToIframe(iframe, {
    targetOrigin: "https://embed.example.com",
});

// Iframe
const transport = await connectToParent({
    allowedOrigin: "https://app.example.com",
});
```

The default `"*"` is convenient for development but accepts messages from any origin.

## Error Handling

If the remote side doesn't complete the handshake within the timeout, the promise rejects:

```ts
import { PostalHandshakeTimeoutError } from "postal-transport-messageport";

try {
    const transport = await connectToIframe(iframe, { timeout: 3000 });
} catch (err) {
    if (err instanceof PostalHandshakeTimeoutError) {
        console.log(`Gave up after ${err.timeout}ms`);
    }
}
```

Make sure the iframe/worker has loaded and called its corresponding `connectTo*` function before the timeout fires.

## Structured Clone

Data flows through `MessagePort.postMessage()`, which uses [structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). This means envelope payloads can contain nested objects, arrays, `Date`s, `Map`s, `Set`s, `ArrayBuffer`s, etc. — but not functions, DOM nodes, or `Error` instances.

## License

MIT
