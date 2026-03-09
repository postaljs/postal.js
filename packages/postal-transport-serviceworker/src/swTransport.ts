/**
 * ServiceWorker-side transport manager for the postal SW bridge.
 *
 * Installs a message listener on the SW global scope and handles incoming
 * syn handshakes from tabs. Each successful handshake becomes a dedicated
 * MessagePort transport registered with postal via addTransport().
 *
 * @module
 */

import { addTransport } from "postal";
import { createMessagePortTransport } from "postal-transport-messageport";
import { createSwAck, isSwSyn } from "./protocol";
import type { SwListenOptions } from "./types";

type ConnectionEntry = {
    port: MessagePort;
    removeTransport: () => void;
};

type SwListenResult = {
    /** Tears down the message listener and disposes all active client connections. */
    dispose: () => void;
};

/**
 * Listens for incoming client connections on the ServiceWorker global scope.
 *
 * For each connecting tab, completes the syn/ack handshake, wraps the received
 * port in a MessagePort transport, and registers it with postal's global
 * addTransport(). Tracks each connection so they can be cleaned up on demand
 * or when a port closes.
 *
 * @param options - Optional filter to apply to each client transport
 * @returns An object with a dispose() function for full teardown
 */
export const listenForClients = (options: SwListenOptions = {}): SwListenResult => {
    const { filter } = options;
    const connections = new Map<MessagePort, ConnectionEntry>();
    let disposed = false;

    const onMessage = (event: ExtendableMessageEvent): void => {
        if (disposed) {
            return;
        }

        // Only respond to postal SW syn messages — ignore all other SW traffic
        if (!isSwSyn(event.data) || event.ports.length === 0) {
            return;
        }

        const port = event.ports[0];

        // Send ack before creating the transport so the client-side ack listener
        // is guaranteed to see the ack before any envelope messages could arrive.
        port.postMessage(createSwAck());

        const transport = createMessagePortTransport(port);
        const removeTransport = addTransport(transport, { filter });

        connections.set(port, { port, removeTransport });

        // Clean up this connection if the port closes (tab unloads or client disposes)
        port.addEventListener("close", () => {
            const entry = connections.get(port);
            if (entry) {
                entry.removeTransport();
                connections.delete(port);
            }
        });
    };

    // The SW global is ServiceWorkerGlobalScope, but TypeScript's lib.webworker
    // types `self` as WorkerGlobalScope. The cast is unavoidable without a
    // separate @types/serviceworker package — at runtime this works correctly.
    (self as unknown as ServiceWorkerGlobalScope).addEventListener("message", onMessage);

    const dispose = (): void => {
        if (disposed) {
            return;
        }
        disposed = true;

        (self as unknown as ServiceWorkerGlobalScope).removeEventListener("message", onMessage);

        // Close ports explicitly rather than relying on postal's internal chain.
        // listenForClients owns these ports, so it should close them directly.
        for (const [, entry] of connections) {
            entry.removeTransport();
            entry.port.close();
        }
        connections.clear();
    };

    return { dispose };
};
