// Node.js entry point — worker_threads helpers + shared core.
// Deliberately does NOT re-export browser helpers (connectToWorker,
// connectToHost, connectToIframe, connectToParent) so that this entry
// point stays free of anything that references browser globals.

// Node worker_threads helpers
export { connectToWorkerThread, connectFromWorkerThread } from "./worker-thread";

// Low-level transport (environment-agnostic)
export { createMessagePortTransport } from "./messagePortTransport";

// Transferable marking
export { markTransferable } from "./transferables";

// Errors
export { PostalHandshakeTimeoutError } from "./errors";

// Protocol version (for debugging / version detection)
export { PROTOCOL_VERSION } from "./protocol";

// Types
export type { ConnectOptions } from "./types";
