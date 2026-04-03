/**
 * Unix domain socket transport for postal.
 *
 * Bridges pub/sub across independent Node.js processes via a UDS
 * with NDJSON framing. Any process can connect to a known socket path —
 * no parent/child relationship required.
 *
 * @module
 */

// Low-level transport
export { createSocketTransport } from "./socketTransport";
export type { UdsSocket } from "./socketTransport";

// Server
export { listenOnSocket } from "./server";

// Client
export { connectToSocket } from "./client";

// Error classes
export { PostalUdsHandshakeTimeoutError, PostalUdsVersionMismatchError } from "./errors";

// Protocol
export { PROTOCOL_VERSION } from "./protocol";

// Types
export type { UdsServerOptions, UdsConnectOptions, Serializer } from "./types";
