// Client-side (tab) API
export { connectToServiceWorker } from "./clientTransport";

// Errors
export { PostalSwHandshakeTimeoutError, PostalSwNotActiveError } from "./errors";

// Types
export type { ClientConnectOptions } from "./types";

// Protocol version (for debugging / version detection)
export { PROTOCOL_VERSION } from "./protocol";
