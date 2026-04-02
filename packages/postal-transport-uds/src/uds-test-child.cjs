/**
 * Child process helper for UDS integration tests.
 *
 * Forked by the test runner. Receives commands via IPC, uses the real
 * postal + postal-transport-uds APIs, and reports results back. Each
 * child is a genuinely separate postal instance with its own instanceId,
 * so echo prevention works exactly as it does in production.
 *
 * Uses CJS + built dist so it runs under plain Node without ts-jest.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { getChannel, resetChannels } = require("postal");
const { connectToSocket, listenOnSocket } = require("postal-transport-uds");

const send = (msg) => {
    if (process.send) {
        process.send(msg);
    }
};

const handlers = {
    /**
     * Connect to a UDS server.
     * payload: { socketPath, timeout? }
     */
    async connect({ socketPath, timeout }) {
        const disconnect = await connectToSocket(socketPath, {
            timeout,
            onDisconnect: () => send({ type: "disconnected" }),
        });
        // Stash for later cleanup
        handlers._disconnect = disconnect;
        send({ type: "connected" });
    },

    /**
     * Start a UDS server.
     * payload: { socketPath, filter?, timeout? }
     */
    async listen({ socketPath, filter, timeout }) {
        const { dispose } = await listenOnSocket(socketPath, { filter, timeout });
        handlers._dispose = dispose;
        send({ type: "listening" });
    },

    /**
     * Subscribe to a channel/topic and forward received envelopes via IPC.
     * payload: { channel, topic }
     */
    subscribe({ channel, topic }) {
        const ch = getChannel(channel || "/");
        ch.subscribe(topic, (envelope) => {
            send({
                type: "envelope",
                envelope: {
                    channel: envelope.channel,
                    topic: envelope.topic,
                    payload: envelope.payload,
                },
            });
        });
        send({ type: "subscribed" });
    },

    /**
     * Publish a message on a channel/topic.
     * payload: { channel, topic, data }
     */
    publish({ channel, topic, data }) {
        const ch = getChannel(channel || "/");
        ch.publish(topic, data);
        send({ type: "published" });
    },

    /**
     * Dispose server or disconnect client and exit.
     */
    async teardown() {
        if (handlers._disconnect) {
            handlers._disconnect();
        }
        if (handlers._dispose) {
            handlers._dispose();
        }
        resetChannels();
        send({ type: "torndown" });
    },
};

process.on("message", async (msg) => {
    const { command, ...payload } = msg;
    try {
        await handlers[command](payload);
    } catch (err) {
        send({ type: "error", message: err.message, code: err.code });
    }
});

send({ type: "ready" });
