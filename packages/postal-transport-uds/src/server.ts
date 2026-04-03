/**
 * UDS server — listens for incoming client connections on a Unix domain socket.
 *
 * For each connecting client, completes a SYN/ACK handshake, wraps the socket
 * in a Transport, and registers it with postal via addTransport(). Postal's
 * core handles fan-out and echo prevention automatically.
 *
 * @module
 */

import * as net from "node:net";
import * as fs from "node:fs";
import { addTransport } from "postal";
import { createSocketTransport } from "./socketTransport";
import { isUdsSyn, looksLikeSyn, createUdsAck, DEFAULT_TIMEOUT } from "./protocol";
import { createLineParser, ndjsonSerializer } from "./serialization";
import type { UdsServerOptions } from "./types";

/** Maps each connected client socket to its transport-removal function. */
type ConnectionMap = Map<net.Socket, () => void>;

/**
 * Creates a net.Server, unlinks stale socket file, listens on the path,
 * and handles incoming postal client connections.
 *
 * @param socketPath - Path for the Unix domain socket file
 * @param options - Server configuration
 * @returns Promise resolving with a dispose function for full teardown
 */
export const listenOnSocket = (
    socketPath: string,
    options: UdsServerOptions = {}
): Promise<{ dispose: () => void }> => {
    const { filter, unlinkStale = true, timeout = DEFAULT_TIMEOUT } = options;
    const connections: ConnectionMap = new Map();
    let disposed = false;

    // Attempt to unlink a stale socket file left by a crashed process
    if (unlinkStale) {
        try {
            fs.unlinkSync(socketPath);
        } catch (err: unknown) {
            // ENOENT is fine — no stale file to clean up
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
                throw err;
            }
        }
    }

    const server = net.createServer();

    server.on("connection", (clientSocket: net.Socket) => {
        if (disposed) {
            clientSocket.destroy();
            return;
        }

        let handshakeComplete = false;

        // Timeout for slow/non-postal clients that never send SYN
        const timer = setTimeout(() => {
            if (!handshakeComplete) {
                clientSocket.destroy();
            }
        }, timeout);

        const onData = createLineParser(parsed => {
            if (handshakeComplete) {
                return;
            }

            // Detect version mismatch before it times out with an unhelpful error
            if (!isUdsSyn(parsed) && looksLikeSyn(parsed)) {
                handshakeComplete = true;
                clearTimeout(timer);
                clientSocket.removeListener("data", onData);
                clientSocket.destroy();
                return;
            }

            if (isUdsSyn(parsed)) {
                handshakeComplete = true;
                clearTimeout(timer);
                clientSocket.removeListener("data", onData);

                // Send ACK before creating the transport so the client's
                // ACK listener sees it before any envelope messages arrive
                clientSocket.write(ndjsonSerializer.encode(createUdsAck()));

                const transport = createSocketTransport(clientSocket);
                const removeTransport = addTransport(transport, { filter });

                connections.set(clientSocket, removeTransport);

                // Both close and error can fire for the same socket death,
                // so the handler is idempotent — the Map lookup guards against
                // double-removal.
                const onClose = (): void => {
                    const removeFn = connections.get(clientSocket);
                    if (removeFn) {
                        removeFn();
                        connections.delete(clientSocket);
                    }
                };

                clientSocket.on("close", onClose);
                clientSocket.on("error", onClose);
            }
        });

        clientSocket.on("data", onData);
    });

    return new Promise<{ dispose: () => void }>((resolve, reject) => {
        const onStartupError = (err: Error): void => {
            reject(err);
        };

        server.on("error", onStartupError);

        server.listen(socketPath, () => {
            // Swap the pre-listen error handler for one that surfaces
            // post-startup errors instead of silently dropping them
            server.removeListener("error", onStartupError);
            server.on("error", (err: Error) => {
                queueMicrotask(() => {
                    throw err;
                });
            });

            const dispose = (): void => {
                if (disposed) {
                    return;
                }
                disposed = true;

                server.close();

                for (const [socket, removeTransport] of connections) {
                    removeTransport();
                    socket.destroy();
                }
                connections.clear();
            };

            resolve({ dispose });
        });
    });
};
