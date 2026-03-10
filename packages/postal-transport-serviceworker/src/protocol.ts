/**
 * Postal ServiceWorker handshake protocol.
 *
 * Namespaced to "postal:sw-" to avoid collisions with the generic MessagePort
 * protocol ("postal:syn" / "postal:ack"). A tab may run both transports
 * simultaneously — different namespaces prevent one handshake listener from
 * eating the other's messages.
 *
 * Handshake sequence:
 *   1. Tab creates a MessageChannel and sends { type: "postal:sw-syn" } to the
 *      active SW via registration.active.postMessage(), transferring port2.
 *   2. SW receives the syn, sends { type: "postal:sw-ack" } through the received port.
 *   3. Tab receives ack on port1 and wraps it in createMessagePortTransport().
 *   4. SW wraps its port in createMessagePortTransport() and registers it.
 *
 * @module
 */

/** Protocol version — bump if the handshake format changes. */
export const PROTOCOL_VERSION = 1;

/** Default handshake timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 5000;

const SW_NAMESPACE = "postal:sw-";

// --- Message shapes ---

export type SwHandshakeMessage = {
    type: "postal:sw-syn" | "postal:sw-ack";
    version: number;
};

// --- Type guards ---

const isSwMessage = (data: unknown): data is SwHandshakeMessage => {
    return (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        typeof (data as SwHandshakeMessage).type === "string" &&
        (data as SwHandshakeMessage).type.startsWith(SW_NAMESPACE)
    );
};

export const isSwSyn = (data: unknown): data is SwHandshakeMessage => {
    return isSwMessage(data) && data.type === "postal:sw-syn";
};

export const isSwAck = (data: unknown): data is SwHandshakeMessage => {
    return isSwMessage(data) && data.type === "postal:sw-ack";
};

// --- Message factories ---

export const createSwSyn = (): SwHandshakeMessage => ({
    type: "postal:sw-syn",
    version: PROTOCOL_VERSION,
});

export const createSwAck = (): SwHandshakeMessage => ({
    type: "postal:sw-ack",
    version: PROTOCOL_VERSION,
});
