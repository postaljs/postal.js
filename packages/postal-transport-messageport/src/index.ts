// Low-level
export { createMessagePortTransport } from "./messagePortTransport";

// Iframe
export { connectToIframe, connectToParent } from "./iframe";

// Dedicated Worker
export { connectToWorker, connectToHost } from "./worker";

// Types
export type { ConnectOptions } from "./types";

// Errors
export { PostalHandshakeTimeoutError } from "./errors";

// Protocol (for version detection / debugging)
export { PROTOCOL_VERSION } from "./protocol";
