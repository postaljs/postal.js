# postal-transport-uds

Unix domain socket transport for [postal](https://github.com/postaljs/postal.js) — bridges pub/sub across independent Node.js processes via a UDS with NDJSON framing. Any process can connect to a known socket path; no parent/child relationship required.

## Installation

```bash
npm install postal postal-transport-uds
```

## Usage

### Server

One process listens on a socket path and accepts connections from any number of clients:

```ts
import { getChannel } from "postal";
import { listenOnSocket } from "postal-transport-uds";

const { dispose } = await listenOnSocket("/tmp/postal.sock");

// Messages published here are forwarded to all connected clients
getChannel("jobs").publish("task.start", { id: 1 });

// Tear down when done
dispose();
```

### Client

Other processes connect to the server's socket path:

```ts
import { getChannel } from "postal";
import { connectToSocket } from "postal-transport-uds";

const removeTransport = await connectToSocket("/tmp/postal.sock", {
    onDisconnect: () => {
        console.log("Server went away");
    },
});

getChannel("jobs").subscribe("task.start", env => {
    console.log("Got task:", env.payload);
});

// Disconnect when done
removeTransport();
```

### Filtering

Restrict which envelopes the server forwards:

```ts
const { dispose } = await listenOnSocket("/tmp/postal.sock", {
    filter: {
        channels: ["jobs"],
        topics: ["task.#"],
    },
});
```

### Low-level transport

If you manage the socket and handshake yourself, use the low-level factory:

```ts
import { createSocketTransport } from "postal-transport-uds";
import { addTransport } from "postal";

const transport = createSocketTransport(myConnectedSocket);
addTransport(transport);
```

## API

### `listenOnSocket(socketPath, options?)`

Creates a `net.Server` on the given Unix domain socket path. For each connecting client, performs a SYN/ACK handshake and registers a transport with postal. Returns `Promise<{ dispose }>`.

### `connectToSocket(socketPath, options?)`

Connects to a postal UDS server. Performs a SYN/ACK handshake and registers a transport. Returns `Promise<() => void>` (the remove function).

### `createSocketTransport(socket, serializer?)`

Low-level factory. Wraps any object with `write()`, `on('data')`, and `removeListener('data')` in a postal `Transport`. Handles NDJSON framing, buffering, and dispatch. Does not own the socket lifecycle.

### Options

| Option         | Type              | Default | Used by        | Description                                  |
| -------------- | ----------------- | ------- | -------------- | -------------------------------------------- |
| `timeout`      | `number`          | `5000`  | server, client | Handshake timeout in milliseconds            |
| `filter`       | `TransportFilter` | —       | server         | Restrict forwarded channels/topics           |
| `unlinkStale`  | `boolean`         | `true`  | server         | Unlink existing socket file before listening |
| `onDisconnect` | `() => void`      | —       | client         | Called on unexpected socket close            |

## How It Works

- **Topology**: Hub-and-spoke. One server, N clients. The server registers each client as a separate transport; postal's core `broadcastToTransports()` handles fan-out and echo prevention via the `source` field.
- **Wire format**: NDJSON — `JSON.stringify(message) + "\n"`. Self-delimiting, debuggable with `socat`/`netcat`, zero dependencies.
- **Handshake**: Client sends `{ type: "postal:uds-syn" }`, server responds with `{ type: "postal:uds-ack" }`. Both happen over the same NDJSON stream as envelopes.
- **Serialization**: Abstracted behind a `Serializer` interface (`encode`/`decode`). The default is NDJSON; swap in MessagePack or similar without restructuring the transport.

## Known Limitations

- **Binary payloads**: NDJSON uses JSON serialization. `Buffer` and `ArrayBuffer` values would need base64 encoding. Acceptable for typical pub/sub payloads.
- **No auto-reconnection**: The transport exposes `onDisconnect`; the consumer decides what to do. Reconnection policy (backoff, retries, state reconciliation) is a userland concern.
- **Single-user socket**: The socket file inherits default permissions. All connecting processes must run as the same OS user (or adjust permissions manually).
- **Node.js only**: Uses `node:net` and `node:fs`. Not available in browsers.

## License

MIT
