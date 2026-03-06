/**
 * High-level wrappers for connecting postal across Node.js worker_threads.
 *
 * - Main thread calls `connectToWorkerThread()` — creates a MessageChannel,
 *   transfers port2 to the worker, waits for ACK.
 * - Worker calls `connectFromWorkerThread()` — listens on parentPort for a
 *   SYN carrying a transferred port, sends ACK back through it.
 *
 * Both resolve with a Transport backed by their end of the port.
 *
 * Node's worker_threads.MessagePort supports the same EventTarget API
 * as browser MessagePort, so createMessagePortTransport works as-is.
 * The difference is in bootstrapping: we use parentPort instead of
 * globalThis, and Node's Worker.postMessage takes a transfer list as
 * the second argument (no targetOrigin).
 *
 * Node's MessagePort type from @types/node omits `onmessage` and
 * `onmessageerror` vs the DOM type, even though both have the same runtime
 * behavior. We cast to `MessagePort` (DOM) where needed since the runtime
 * contract is identical per the verified compatibility table in the build plan.
 *
 * @module
 */

import { MessageChannel, parentPort } from "node:worker_threads";
import type { Worker as NodeWorker } from "node:worker_threads";
import type { Transport } from "postal";
import type { ConnectOptions } from "./types";
import { DEFAULT_TIMEOUT, createSyn, createAck, isAck, isSyn } from "./protocol";
import { createMessagePortTransport } from "./messagePortTransport";
import { PostalHandshakeTimeoutError } from "./errors";

/**
 * Connects to a postal instance running inside a Node.js Worker thread.
 *
 * Called from the **main thread** (or any spawning thread). The worker must
 * call `connectFromWorkerThread()` to complete the handshake.
 *
 * @param worker - The Worker instance from node:worker_threads
 * @param options - Timeout settings
 * @returns Promise resolving with a connected Transport
 * @throws PostalHandshakeTimeoutError if the worker doesn't ACK in time
 */
export const connectToWorkerThread = (
    worker: NodeWorker,
    options: Pick<ConnectOptions, "timeout"> = {}
): Promise<Transport> => {
    const { timeout = DEFAULT_TIMEOUT } = options;

    return new Promise<Transport>((resolve, reject) => {
        const channel = new MessageChannel();
        const { port1, port2 } = channel;

        // Cast to DOM MessagePort — same runtime API, @types/node just omits
        // onmessage/onmessageerror which aren't used in this handshake path.
        const domPort1 = port1 as unknown as MessagePort;

        const timer = setTimeout(() => {
            domPort1.removeEventListener("message", onAck);
            domPort1.close();
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onAck = (event: MessageEvent): void => {
            if (isAck(event.data)) {
                clearTimeout(timer);
                domPort1.removeEventListener("message", onAck);
                resolve(createMessagePortTransport(domPort1));
            }
        };

        domPort1.addEventListener("message", onAck);
        domPort1.start();

        // Node's Worker.postMessage takes a transferList as the second arg,
        // not a targetOrigin — there's no cross-origin concept in worker_threads.
        worker.postMessage(createSyn(), [port2]);
    });
};

/**
 * Listens for a postal handshake initiated by the parent thread.
 *
 * Called from **inside the Worker thread**. Waits for a SYN on parentPort
 * with a transferred MessagePort, sends ACK back through it, and resolves
 * with a Transport wrapping the port.
 *
 * @param options - Timeout settings
 * @returns Promise resolving with a connected Transport
 * @throws Error if called outside a worker thread (parentPort is null)
 * @throws PostalHandshakeTimeoutError if no SYN arrives in time
 */
export const connectFromWorkerThread = (
    options: Pick<ConnectOptions, "timeout"> = {}
): Promise<Transport> => {
    // parentPort is null when this module is loaded in the main thread.
    // Fail fast with a clear message rather than hanging indefinitely.
    if (parentPort === null) {
        return Promise.reject(
            new Error("connectFromWorkerThread must be called from inside a Worker thread")
        );
    }

    const { timeout = DEFAULT_TIMEOUT } = options;

    // Cast to EventTarget — parentPort implements EventTarget but @types/node
    // types it with its own narrower type. The addEventListener/removeEventListener
    // signatures we need are identical at runtime.
    const pp = parentPort as unknown as MessagePort;

    return new Promise<Transport>((resolve, reject) => {
        const timer = setTimeout(() => {
            pp.removeEventListener("message", onSyn);
            reject(new PostalHandshakeTimeoutError(timeout));
        }, timeout);

        const onSyn = (event: MessageEvent): void => {
            if (isSyn(event.data) && event.ports.length > 0) {
                clearTimeout(timer);
                pp.removeEventListener("message", onSyn);

                const port = event.ports[0] as unknown as MessagePort;
                port.postMessage(createAck());
                resolve(createMessagePortTransport(port));
            }
        };

        pp.addEventListener("message", onSyn);
    });
};
