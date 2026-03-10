// Low-level (no handshake)
export { createIPCTransport } from "./ipcTransport";

// cluster helpers
export { connectToClusterWorker, connectToClusterPrimary } from "./clusterHelpers";

// Types
export type { ConnectOptions } from "./types";

// Errors
export { PostalHandshakeTimeoutError } from "./errors";

// Protocol (debugging / version detection)
export { PROTOCOL_VERSION } from "./protocol";
