# postal-transport-uds — LLM Usage Guide

npm: `postal-transport-uds` | peer dep: `postal ^3.2.0`

---

## What This Package Does

Bridges postal pub/sub across independent Node.js processes via Unix domain sockets with NDJSON framing. Unlike the `childprocess` transport, processes don't need a parent/child relationship — any process can connect to a known socket path.

The architecture is hub-and-spoke: one server process listens on a socket path, N client processes connect. The server registers each client as a separate transport; postal's core handles fan-out and echo prevention automatically.

---

## When to Use This vs Other Node.js Transports

| Scenario                                 | Use                                     |
| ---------------------------------------- | --------------------------------------- |
| Parent process spawns child via `fork()` | `postal-transport-childprocess`         |
| Cluster primary ↔ workers                | `postal-transport-childprocess/cluster` |
| Independent processes, same machine      | `postal-transport-uds`                  |
| Processes on different machines          | Neither — use WebSocket or similar      |
| Node.js worker_threads                   | `postal-transport-messageport/node`     |

The childprocess transport requires IPC channels created by `fork()` or `cluster`. The UDS transport decouples process lifecycle from messaging — processes can start and stop independently.

---

## Exports

```ts
// High-level: server
listenOnSocket(socketPath: string, options?: UdsServerOptions): Promise<{ dispose: () => void }>

// High-level: client
connectToSocket(socketPath: string, options?: UdsConnectOptions): Promise<() => void>

// Low-level: wraps a connected socket in a Transport
createSocketTransport(socket: UdsSocket, serializer?: Serializer): Transport

// Error class
PostalUdsHandshakeTimeoutError  // extends Error, has .timeout property

// Protocol
PROTOCOL_VERSION: number  // currently 1

// Types
type UdsServerOptions = {
    filter?: TransportFilter;
    unlinkStale?: boolean;  // default true
    timeout?: number;       // default 5000
}

type UdsConnectOptions = {
    timeout?: number;       // default 5000
    onDisconnect?: () => void;
}

type UdsSocket = {
    write: (data: string) => void;
    on: (event: "data", handler: (chunk: string | Buffer) => void) => void;
    removeListener: (event: "data", handler: (chunk: string | Buffer) => void) => void;
}

type Serializer = {
    encode: (msg: unknown) => string;
    decode: (line: string) => unknown;
}
```

---

## Usage

### Server: accept connections from any process

```ts
import { getChannel } from "postal";
import { listenOnSocket } from "postal-transport-uds";

const { dispose } = await listenOnSocket("/tmp/postal.sock");

getChannel("jobs").publish("task.start", { id: 1 });

// Tear down server, disconnect all clients
dispose();
```

### Client: connect to a server

```ts
import { getChannel } from "postal";
import { connectToSocket } from "postal-transport-uds";

const removeTransport = await connectToSocket("/tmp/postal.sock", {
    onDisconnect: () => console.log("Server went away"),
});

getChannel("jobs").subscribe("task.start", env => {
    console.log("Got task:", env.payload);
});

// Explicit disconnect
removeTransport();
```

### Filtering on the server

```ts
const { dispose } = await listenOnSocket("/tmp/postal.sock", {
    filter: {
        channels: ["jobs"],
        topics: ["task.#"],
    },
});
```

### Low-level: BYO socket

```ts
import { addTransport } from "postal";
import { createSocketTransport } from "postal-transport-uds";

// Any object with write(), on("data"), removeListener("data")
const transport = createSocketTransport(mySocket);
addTransport(transport);
```

---

## Wire Format

Messages are NDJSON — one JSON object per line, delimited by `\n`:

```json
{"type":"postal:uds-syn","version":1}
{"type":"postal:uds-ack","version":1}
{"type":"postal:envelope","version":1,"envelope":{"id":"...","type":"publish","channel":"jobs","topic":"task.start","payload":{"id":1},"timestamp":1234567890,"source":"..."}}
```

The `postal:uds-` prefix on handshake messages avoids collisions if a process runs multiple transport types. Envelope messages use the shared `postal:envelope` type.

---

## Handshake Sequence

1. Client calls `net.connect(socketPath)` — TCP connection established
2. Client sends `{ type: "postal:uds-syn", version: 1 }` as NDJSON
3. Server receives SYN, responds with `{ type: "postal:uds-ack", version: 1 }`
4. Both sides wrap the socket in `createSocketTransport()` and register with postal

If the handshake doesn't complete within the timeout (default 5s), the socket is destroyed and the promise rejects with `PostalUdsHandshakeTimeoutError`.

---

## Non-Obvious Behavior

**The server unlinks stale socket files by default.** If a previous process crashed without cleaning up, the socket file is left behind. `listenOnSocket` calls `unlinkSync` before `listen()` to remove it. Set `unlinkStale: false` to disable this.

**`onDisconnect` does NOT fire on explicit cleanup.** Calling the returned remove function destroys the socket but removes the close listener first, so `onDisconnect` only fires on unexpected disconnection (server crash, network error). This matches the ServiceWorker transport's `onControllerChange` pattern.

**The transport does not own the socket lifecycle.** `createSocketTransport` does not call `socket.destroy()` on dispose — it only removes its `data` listener. The server and client modules own their sockets. This matters if you use the low-level API directly.

**No auto-reconnection.** The `onDisconnect` callback is the seam for implementing retry logic. Backoff strategy, retry limits, and state reconciliation are consumer concerns.

**Fan-out is handled by postal core, not the server.** Each client connection is registered as a separate transport via `addTransport()`. Postal's `broadcastToTransports()` handles fan-out and echo prevention. There is no relay logic in the server.

**Serialization is pluggable.** Pass a custom `Serializer` to `createSocketTransport()` to swap NDJSON for MessagePack or another format. The interface is `{ encode(msg): string, decode(line): unknown }`.
