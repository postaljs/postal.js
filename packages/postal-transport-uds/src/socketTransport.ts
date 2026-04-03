/**
 * Low-level Transport backed by a net.Socket with NDJSON framing.
 *
 * Works with any object that satisfies the UdsSocket shape — real
 * net.Socket instances or test mocks based on EventEmitter.
 *
 * The transport does NOT own the socket lifecycle. dispose() removes
 * the data listener and clears subscribers, but does NOT call
 * socket.destroy(). The server/client modules own their sockets.
 *
 * @module
 */

import type { Transport, Envelope } from "postal";
import { isUdsEnvelopeMessage, createUdsEnvelopeMessage } from "./protocol";
import { createLineParser, ndjsonSerializer, type Serializer } from "./serialization";

/**
 * Minimal socket surface — anything with write, on, and removeListener
 * for the "data" event. Typed loosely to avoid importing @types/node.
 */
export type UdsSocket = {
    write: (data: string) => void;
    on: (event: "data", handler: (chunk: string | Buffer) => void) => void;
    removeListener: (event: "data", handler: (chunk: string | Buffer) => void) => void;
};

/**
 * Creates a Transport from a socket with NDJSON framing.
 *
 * Buffers incoming data events, splits on newlines, parses each complete
 * line as JSON, and dispatches postal envelope messages to subscribers.
 *
 * @param socket - A connected net.Socket (or compatible mock)
 * @param serializer - Encode/decode strategy (defaults to NDJSON)
 * @returns A Transport suitable for postal's addTransport()
 */
export const createSocketTransport = (
    socket: UdsSocket,
    serializer: Serializer = ndjsonSerializer
): Transport => {
    let disposed = false;
    const listeners: ((envelope: Envelope) => void)[] = [];

    const onData = createLineParser(parsed => {
        if (disposed) {
            return;
        }

        if (isUdsEnvelopeMessage(parsed)) {
            const { envelope } = parsed;
            // Snapshot — safe if a listener unsubscribes during iteration
            for (const listener of [...listeners]) {
                try {
                    listener(envelope);
                } catch (err) {
                    // Re-throw asynchronously so a single bad listener doesn't
                    // kill delivery to the rest.
                    queueMicrotask(() => {
                        throw err;
                    });
                }
            }
        }
    }, serializer);

    socket.on("data", onData);

    const send = (envelope: Envelope): void => {
        if (disposed) {
            return;
        }
        socket.write(serializer.encode(createUdsEnvelopeMessage(envelope)));
    };

    const subscribe = (callback: (envelope: Envelope) => void): (() => void) => {
        if (disposed) {
            return () => {};
        }

        listeners.push(callback);

        let removed = false;
        return () => {
            if (removed) {
                return;
            }
            removed = true;
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        };
    };

    const dispose = (): void => {
        if (disposed) {
            return;
        }
        disposed = true;
        socket.removeListener("data", onData);
        listeners.splice(0, listeners.length);
        // Intentionally NOT calling socket.destroy().
        // The transport is a consumer of the socket, not its owner.
    };

    return { send, subscribe, dispose };
};
