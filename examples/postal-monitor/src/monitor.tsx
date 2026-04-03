// Monitor — UDS server entry point for the postal-monitor TUI.
//
// This process is the UDS *server*. It starts first and waits for reporter
// clients to connect. The role split (monitor=server, reporters=clients) maps
// cleanly to their lifecycles: the monitor is long-running, reporters are
// ephemeral.
//
// How it works (the full postal/UDS flow):
//
//   1. listenOnSocket() creates a net.Server on the UDS socket path.
//   2. When a reporter connects, the SYN/ACK handshake registers a Transport.
//   3. The reporter calls connectToSocket(), which also registers a Transport.
//   4. Now postal envelopes flow bidirectionally across the socket.
//   5. The reporter calls getChannel("monitor").publish("task.started", payload).
//   6. Postal routes the envelope through the UDS Transport to this process.
//   7. Our subscribe("task.#") callback fires with the payload.
//   8. We call the React setState function, triggering an Ink re-render.
//
// Run it with:
//   pnpm --filter @postal-examples/postal-monitor start:monitor

import React, { useState } from "react";
import { render } from "ink";
import { getChannel } from "postal";
import { listenOnSocket } from "postal-transport-uds";
import App from "./components/App.js";
import {
    createInitialState,
    applyTaskStarted,
    applyTaskFinished,
    type MonitorState,
} from "./monitor-state.js";
// Importing from types.ts both pulls in the payload types and activates the
// ChannelRegistry module augmentation that gives getChannel("monitor")
// compile-time type safety on subscribe/publish calls.
import type { TaskStartedPayload, TaskFinishedPayload } from "./types.js";

const SOCKET_PATH = "/tmp/postal-monitor.sock";

const main = async (): Promise<void> => {
    // Step 1: Start the UDS server.
    //
    // listenOnSocket handles stale socket cleanup (unlinkStale: true removes
    // a leftover .sock file from a previous crashed run), performs the SYN/ACK
    // handshake for each connecting client, and registers each connection as a
    // postal Transport automatically.
    let serverDispose: (() => void) | undefined;
    try {
        const server = await listenOnSocket(SOCKET_PATH, { unlinkStale: true });
        serverDispose = server.dispose;
    } catch (err: unknown) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === "EADDRINUSE") {
            process.stderr.write(
                `Error: Socket ${SOCKET_PATH} is already in use.\n` +
                    "Another monitor instance may be running. Stop it first.\n"
            );
        } else {
            process.stderr.write(`Error starting monitor: ${String(err)}\n`);
        }
        process.exit(1);
    }

    process.stdout.write(`Listening on ${SOCKET_PATH}\n`);
    process.stdout.write("Waiting for launcher... (run start:launcher in another terminal)\n");

    // Step 2: Subscribe to task events on the "monitor" channel.
    //
    // "task.#" is an AMQP-style wildcard: # matches zero or more dot-separated
    // segments, so this subscription receives task.started, task.finished, and
    // any future task.* topics without needing to change this code.
    const channel = getChannel("monitor");

    // We bridge postal subscriptions (Node event loop) into React state (Ink
    // render cycle) by holding a mutable reference to React's setState.
    // The reference is set inside the component on first render and then used
    // from the subscription callbacks below.
    let setState: React.Dispatch<React.SetStateAction<MonitorState>> | undefined;
    let currentState: MonitorState = createInitialState();

    // Step 3: Render the Ink TUI before wiring up subscriptions.
    //
    // MonitorApp captures the React setState function so the subscription
    // callbacks below can trigger re-renders from outside the React tree.
    // Rendering first ensures setState is assigned before any events arrive,
    // eliminating the window where an early event would be silently dropped.
    const MonitorApp: React.FC = () => {
        // Initialise from currentState so any events that arrived between
        // server start and first render are not lost.
        const [state, setStateLocal] = useState<MonitorState>(currentState);

        // Assign to the outer reference on every render — stable in practice
        // because React guarantees setState identity across renders.
        setState = setStateLocal;

        return <App state={state} />;
    };

    // Clear the screen before Ink takes over so the pre-render messages don't
    // interfere with the TUI layout.
    process.stdout.write("\x1b[2J\x1b[H");

    const { unmount } = render(<MonitorApp />);

    // Step 4: Wire up the state reducers to the postal subscriptions.
    //
    // Each subscription callback applies the incoming payload to the current
    // state via a pure reducer, then calls React's setState to trigger a re-render.
    // subscribe() returns a plain unsubscribe function (not an object).
    // The callback receives an Envelope<TPayload> — payload is at envelope.payload.
    // We subscribe to exact topic strings (not the "task.#" wildcard) so the
    // ChannelRegistry augmentation in types.ts gives us compile-time type safety.
    const unsubscribeStarted = channel.subscribe("task.started", envelope => {
        if (!setState) {
            return;
        }
        // envelope.payload is typed as unknown here because the ChannelRegistry
        // augmentation in types.ts isn't visible to getChannel() when called
        // with an untyped channel reference. Cast explicitly — the types.ts
        // augmentation documents the contract, and the reporter enforces it.
        currentState = applyTaskStarted(currentState, envelope.payload as TaskStartedPayload);
        setState(currentState);
    });

    const unsubscribeFinished = channel.subscribe("task.finished", envelope => {
        if (!setState) {
            return;
        }
        currentState = applyTaskFinished(currentState, envelope.payload as TaskFinishedPayload);
        setState(currentState);
    });

    // Step 5: Clean shutdown on Ctrl+C or SIGTERM.
    const shutdown = (): void => {
        unsubscribeStarted();
        unsubscribeFinished();
        unmount();
        serverDispose?.();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};

main().catch(err => {
    process.stderr.write(`[monitor] Fatal: ${String(err)}\n`);
    process.exit(1);
});
