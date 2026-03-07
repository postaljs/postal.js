# postal-transport-childprocess

[child_process](https://nodejs.org/api/child_process.html) and [cluster](https://nodejs.org/api/cluster.html) IPC transport for [postal](https://github.com/postaljs/postal.js) — bridges pub/sub across Node.js processes.

## Installation

```bash
npm install postal postal-transport-childprocess
```

## Usage

### child_process

**Parent:**

```ts
import { fork } from "child_process";
import { addTransport, getChannel } from "postal";
import { connectToChild } from "postal-transport-childprocess";

const child = fork("./worker.js");
const transport = await connectToChild(child);
const remove = addTransport(transport);

// Clean up when the child exits
child.on("exit", () => remove());
```

**Child (`worker.js`):**

```ts
import { addTransport, getChannel } from "postal";
import { connectToParent } from "postal-transport-childprocess";

const transport = await connectToParent();
addTransport(transport);
```

### cluster

**Primary:**

```ts
import cluster from "cluster";
import { addTransport } from "postal";
import { connectToClusterWorker } from "postal-transport-childprocess/cluster";

const worker = cluster.fork();
const transport = await connectToClusterWorker(worker);
const remove = addTransport(transport);

worker.on("exit", () => remove());
```

**Worker:**

```ts
import { addTransport } from "postal";
import { connectToClusterPrimary } from "postal-transport-childprocess/cluster";

const transport = await connectToClusterPrimary();
addTransport(transport);
```

## API

### `connectToChild(child, options?)`

Initiates a handshake from the parent to a forked child. Rejects if the child's IPC channel is closed or the handshake times out.

### `connectToParent(options?)`

Waits for a SYN from the parent. Rejects immediately if the process has no IPC channel (not spawned with `fork()`).

### `connectToClusterWorker(worker, options?)`

Same as `connectToChild` but accepts a `cluster.Worker`.

### `connectToClusterPrimary(options?)`

Same as `connectToParent` but for cluster workers.

### `createIPCTransport(endpoint)`

Low-level factory. Accepts any object with `send()`, `on('message')`, and `removeListener('message')`. Use this if you manage the handshake yourself.

### Options

| Option    | Type     | Default | Description                       |
| --------- | -------- | ------- | --------------------------------- |
| `timeout` | `number` | `5000`  | Handshake timeout in milliseconds |

## Known Limitations

- **Binary payloads**: Node IPC uses JSON serialization. `Buffer` and `ArrayBuffer` values are serialized as JSON objects — they arrive intact but as plain objects, not typed array instances. Base64-encode binary data before sending it across processes.
- **Reconnection**: This transport does not attempt to reconnect if the IPC channel closes. Wire up `child.on('exit')` / `process.on('disconnect')` to dispose the transport and re-establish if needed.
