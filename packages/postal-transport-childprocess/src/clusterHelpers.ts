/**
 * High-level helpers for connecting postal across a cluster IPC channel.
 *
 * - Primary calls `connectToClusterWorker(worker)` — sends SYN, waits for ACK.
 * - Worker calls `connectToClusterPrimary()` — waits for SYN, sends ACK, resolves.
 *
 * Cluster workers expose the same IPC interface as forked child processes:
 * worker.send() / worker.on('message') on the primary side, and
 * process.send() / process.on('message') inside the worker.
 *
 * Lifecycle note: Wire up worker.on('exit') in the primary to dispose the
 * transport and call the remove function from addTransport() when the worker
 * goes away. This prevents stale postal transports from accumulating.
 *
 * @module
 */

import type { Transport } from "postal";
import type { Worker as ClusterWorker } from "cluster";
import type { ConnectOptions } from "./types";
import { DEFAULT_TIMEOUT, createSyn, createAck, isSyn, isAck } from "./protocol";
import { createIPCTransport, type IPCEndpoint } from "./ipcTransport";
import { PostalHandshakeTimeoutError } from "./errors";

/**
 * Connects to a postal instance running inside a cluster worker.
 *
 * Called from the **cluster primary**. The worker must call
 * `connectToClusterPrimary()` to complete the handshake.
 *
 * @param worker - A Worker created with cluster.fork()
 * @param options - Optional timeout configuration
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if the worker doesn't ACK in time
 */
export const connectToClusterWorker = (
    worker: ClusterWorker,
    options: ConnectOptions = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    // Fail fast if the IPC channel is already gone
    if (!worker.isConnected()) {
        return Promise.reject(new Error("Cannot connect: cluster worker IPC channel is not open"));
    }

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            worker.removeListener("message", onAck);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onAck = (message: unknown): void => {
            if (isAck(message)) {
                clearTimeout(timer);
                worker.removeListener("message", onAck);
                resolve(createIPCTransport(worker as unknown as IPCEndpoint));
            }
        };

        worker.on("message", onAck);

        // Guard against a synchronous throw if the channel closes between the
        // isConnected() check above and the actual send call.
        try {
            worker.send(createSyn());
        } catch (err) {
            clearTimeout(timer);
            worker.removeListener("message", onAck);
            reject(err);
        }
    });
};

/**
 * Listens for a postal handshake initiated by the cluster primary.
 *
 * Called from **inside a cluster worker**. Waits for a SYN from the primary,
 * sends ACK back, and resolves with a Transport wrapping process IPC.
 *
 * @param options - Optional timeout configuration
 * @returns Promise resolving with a connected Transport
 * @throws Error if the process has no IPC channel
 * @throws PostalHandshakeTimeoutError if no SYN arrives in time
 */
export const connectToClusterPrimary = (options: ConnectOptions = {}): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    // Cluster workers always have an IPC channel while running, but we guard
    // defensively in case someone calls this from a non-cluster context.
    if (typeof process.send === "undefined") {
        return Promise.reject(
            new Error("Cannot connect: process was not spawned with an IPC channel")
        );
    }

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            process.removeListener("message", onSyn);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onSyn = (message: unknown): void => {
            if (isSyn(message)) {
                clearTimeout(timer);
                process.removeListener("message", onSyn);
                // Re-check at call time — IPC can disconnect between the guard
                // at the top of connectToClusterPrimary() and this async callback firing.
                // Using ! here would throw an unhandled TypeError on disconnect.
                if (typeof process.send === "function") {
                    process.send(createAck());
                }
                resolve(createIPCTransport(process as unknown as IPCEndpoint));
            }
        };

        process.on("message", onSyn);
    });
};
