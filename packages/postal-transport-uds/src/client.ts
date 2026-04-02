/**
 * UDS client — connects to a postal server via Unix domain socket.
 *
 * Sends SYN, waits for ACK, wraps the socket in a Transport, and registers
 * it with postal via addTransport(). Returns a function to remove the transport.
 *
 * @module
 */

import * as net from "node:net";
import { addTransport } from "postal";
import { createSocketTransport } from "./socketTransport";
import {
    createUdsSyn,
    isUdsAck,
    looksLikeAck,
    PROTOCOL_VERSION,
    DEFAULT_TIMEOUT,
} from "./protocol";
import { createLineParser, ndjsonSerializer } from "./serialization";
import { PostalUdsHandshakeTimeoutError, PostalUdsVersionMismatchError } from "./errors";
import type { UdsConnectOptions } from "./types";

/**
 * Connects to a postal UDS server at the given socket path.
 *
 * Performs a SYN/ACK handshake, wraps the connection in a Transport,
 * and registers it with postal. Returns a function that removes the
 * transport and cleans up the socket.
 *
 * @param socketPath - Path to the server's Unix domain socket
 * @param options - Client configuration
 * @returns Promise resolving with a remove function
 * @throws PostalUdsHandshakeTimeoutError if the server doesn't ACK in time
 */
export const connectToSocket = (
    socketPath: string,
    options: UdsConnectOptions = {}
): Promise<() => void> => {
    const { timeout = DEFAULT_TIMEOUT, onDisconnect } = options;

    return new Promise<() => void>((resolve, reject) => {
        const socket = net.connect(socketPath);
        // Guards the promise from double-settlement — timeout, error, and
        // successful ACK are all racing to resolve/reject.
        let settled = false;

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                socket.destroy();
                reject(new PostalUdsHandshakeTimeoutError(timeout));
            }
        }, timeout);

        const onError = (err: Error): void => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                socket.destroy();
                reject(err);
            }
        };

        socket.on("error", onError);

        const onData = createLineParser(parsed => {
            if (settled) {
                return;
            }

            // Detect version mismatch before it times out with an unhelpful error
            if (!isUdsAck(parsed) && looksLikeAck(parsed)) {
                settled = true;
                clearTimeout(timer);
                socket.removeListener("data", onData);
                socket.removeListener("error", onError);
                socket.destroy();
                reject(new PostalUdsVersionMismatchError(parsed.version, PROTOCOL_VERSION));
                return;
            }

            if (isUdsAck(parsed)) {
                settled = true;
                clearTimeout(timer);
                socket.removeListener("data", onData);
                socket.removeListener("error", onError);

                const transport = createSocketTransport(socket);
                const removeTransport = addTransport(transport);

                // Wire up onDisconnect callback — remove the close listener
                // during cleanup so that calling the returned function doesn't
                // fire onDisconnect spuriously (socket.destroy() triggers close).
                const onClose = onDisconnect ? () => onDisconnect() : undefined;
                if (onClose) {
                    socket.on("close", onClose);
                }

                resolve(() => {
                    if (onClose) {
                        socket.removeListener("close", onClose);
                    }
                    removeTransport();
                    socket.destroy();
                });
            }
        });

        socket.on("data", onData);

        // Send SYN once the connection is established
        socket.on("connect", () => {
            if (!settled) {
                socket.write(ndjsonSerializer.encode(createUdsSyn()));
            }
        });
    });
};
