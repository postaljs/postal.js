// SW-side API — separate entry point so client bundles don't pull in
// ServiceWorkerGlobalScope types or SW-only code.
export { listenForClients } from "./swTransport";

// Errors
export { PostalSwHandshakeTimeoutError, PostalSwNotActiveError } from "./errors";

// Types
export type { SwListenOptions } from "./types";

// Protocol version (for debugging / version detection)
export { PROTOCOL_VERSION } from "./protocol";
