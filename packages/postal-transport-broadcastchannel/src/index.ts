// Transport factory
export { createBroadcastChannelTransport } from "./broadcastChannelTransport";

// Protocol (for version detection / debugging / testing)
export type { EnvelopeMessage } from "./protocol";
export { isEnvelopeMessage, PROTOCOL_VERSION } from "./protocol";
