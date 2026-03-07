/**
 * High-level helpers for connecting postal across a child_process IPC channel.
 *
 * - Parent calls `connectToChild(child)` — sends SYN, waits for ACK.
 * - Child calls `connectToParent()` — waits for SYN, sends ACK, resolves.
 *
 * Both resolve with a Transport backed by their end of the IPC channel.
 *
 * Lifecycle note: Register the returned Transport with postal's addTransport()
 * and wire up the child's 'exit' event to call the remove function returned
 * by addTransport(). This prevents a leaked listener on process disconnect.
 *
 * @module
 */

import type { Transport } from "postal";
import type { ChildProcess } from "child_process";
import type { ConnectOptions } from "./types";
import { DEFAULT_TIMEOUT, createSyn, createAck, isSyn, isAck } from "./protocol";
import { createIPCTransport, type IPCEndpoint } from "./ipcTransport";
import { PostalHandshakeTimeoutError } from "./errors";

/**
 * Connects to a postal instance running inside a forked child process.
 *
 * Called from the **parent process**. The child must call
 * `connectToParent()` to complete the handshake.
 *
 * @param child - A ChildProcess created with child_process.fork()
 * @param options - Optional timeout configuration
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if the child doesn't ACK in time
 */
export const connectToChild = (
    child: ChildProcess,
    options: ConnectOptions = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    // Fail fast if the IPC channel is already gone — send() would throw anyway,
    // but this gives a clearer error before we start a timeout clock.
    if (!child.connected) {
        return Promise.reject(new Error("Cannot connect: child process IPC channel is not open"));
    }

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            child.removeListener("message", onAck);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onAck = (message: unknown): void => {
            if (isAck(message)) {
                clearTimeout(timer);
                child.removeListener("message", onAck);
                resolve(createIPCTransport(child as unknown as IPCEndpoint));
            }
        };

        child.on("message", onAck);

        // Guard against a synchronous throw if the channel closes between the
        // child.connected check above and the actual send call.
        try {
            child.send(createSyn());
        } catch (err) {
            clearTimeout(timer);
            child.removeListener("message", onAck);
            reject(err);
        }
    });
};

/**
 * Listens for a postal handshake initiated by the parent process.
 *
 * Called from **inside the child process**. Waits for a SYN from the parent,
 * sends ACK back, and resolves with a Transport wrapping process IPC.
 *
 * @param options - Optional timeout configuration
 * @returns Promise resolving with a connected Transport
 * @throws Error if the process has no IPC channel (not spawned with fork())
 * @throws PostalHandshakeTimeoutError if no SYN arrives in time
 */
export const connectToParent = (options: ConnectOptions = {}): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    // Fail fast if this process has no IPC channel — happens when the process
    // was spawned without fork() or the channel was already disconnected.
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
                // at the top of connectToParent() and this async callback firing.
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
