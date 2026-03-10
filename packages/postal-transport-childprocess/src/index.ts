// Low-level (no handshake)
export { createIPCTransport } from "./ipcTransport";

// child_process helpers
export { connectToChild, connectToParent } from "./child";

// Types
export type { ConnectOptions } from "./types";

// Errors
export { PostalHandshakeTimeoutError } from "./errors";

// Protocol (debugging / version detection)
export { PROTOCOL_VERSION } from "./protocol";
