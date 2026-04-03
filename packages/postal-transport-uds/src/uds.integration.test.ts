/**
 * Integration tests for postal-transport-uds.
 *
 * Each test forks real child processes — no mocks, no manual protocol hacks.
 * Server and client(s) run in separate processes with independent postal
 * instances, so echo prevention, transport registration, and pub/sub flow
 * are exercised exactly as they work in production.
 *
 * The child helper (uds-test-child.cjs) uses the built dist, so run
 * `pnpm build` before these tests if the dist is stale.
 */

import * as net from "node:net";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { fork, type ChildProcess } from "node:child_process";
import { ndjsonSerializer } from "./serialization";

const CHILD_SCRIPT = path.resolve(__dirname, "uds-test-child.cjs");

const tmpSocketPath = (): string => `/tmp/postal-test-${crypto.randomUUID()}.sock`;

// ---------------------------------------------------------------------------
// Child process orchestration
// ---------------------------------------------------------------------------

type ChildMessage = {
    type: string;
    envelope?: { channel: string; topic: string; payload: unknown };
    message?: string;
    code?: string;
};

/**
 * Forks a child process running the test helper and returns an API
 * for sending commands and waiting for specific IPC messages.
 */
const spawnChild = (): Promise<{
    child: ChildProcess;
    send: (msg: Record<string, unknown>) => void;
    waitFor: (type: string, timeoutMs?: number) => Promise<ChildMessage>;
    collectEnvelopes: () => ChildMessage[];
    kill: () => void;
}> => {
    return new Promise((resolve, reject) => {
        const child = fork(CHILD_SCRIPT, [], { stdio: "pipe" });

        const pendingWaiters: Array<{
            type: string;
            resolve: (msg: ChildMessage) => void;
            reject: (err: Error) => void;
            timer: ReturnType<typeof setTimeout>;
        }> = [];

        const envelopes: ChildMessage[] = [];

        child.on("message", (msg: ChildMessage) => {
            if (msg.type === "envelope") {
                envelopes.push(msg);
            }

            // Check pending waiters
            for (let i = pendingWaiters.length - 1; i >= 0; i--) {
                if (pendingWaiters[i]!.type === msg.type) {
                    const waiter = pendingWaiters.splice(i, 1)[0]!;
                    clearTimeout(waiter.timer);
                    waiter.resolve(msg);
                }
            }
        });

        child.on("error", reject);

        const api = {
            child,
            send: (msg: Record<string, unknown>) => child.send(msg),
            waitFor: (type: string, timeoutMs = 5000): Promise<ChildMessage> => {
                return new Promise((res, rej) => {
                    const timer = setTimeout(() => {
                        rej(
                            new Error(`Timed out waiting for "${type}" from child (${timeoutMs}ms)`)
                        );
                    }, timeoutMs);
                    pendingWaiters.push({ type, resolve: res, reject: rej, timer });
                });
            },
            collectEnvelopes: () => envelopes,
            kill: () => {
                for (const w of pendingWaiters) {
                    clearTimeout(w.timer);
                }
                pendingWaiters.length = 0;
                child.kill();
            },
        };

        // Wait for the child to signal it's ready
        const onReady = (msg: ChildMessage): void => {
            if (msg.type === "ready") {
                child.removeListener("message", onReady);
                resolve(api);
            }
        };
        child.on("message", onReady);
    });
};

/** Wait for a condition with a timeout. Polls every 10ms. */
const waitForCondition = (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = (): void => {
            if (predicate()) {
                resolve();
            } else if (Date.now() - start > timeoutMs) {
                reject(new Error(`waitForCondition timed out after ${timeoutMs}ms`));
            } else {
                setTimeout(check, 10);
            }
        };
        check();
    });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UDS integration", () => {
    let socketPath: string;
    const children: Array<{ kill: () => void }> = [];

    beforeEach(() => {
        socketPath = tmpSocketPath();
    });

    afterEach(async () => {
        // Tear down children gracefully, then kill
        for (const c of children) {
            c.kill();
        }
        children.length = 0;

        // Clean up socket file
        const fs = await import("node:fs");
        try {
            fs.unlinkSync(socketPath);
        } catch {
            // ENOENT is fine
        }
    });

    it("should complete handshake between server and client processes", async () => {
        const server = await spawnChild();
        children.push(server);
        const client = await spawnChild();
        children.push(client);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        client.send({ command: "connect", socketPath });
        await client.waitFor("connected");

        // If we got here, SYN/ACK handshake succeeded across two real
        // processes over a real Unix domain socket.
    });

    it("should deliver messages from server to client", async () => {
        const server = await spawnChild();
        children.push(server);
        const client = await spawnChild();
        children.push(client);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        client.send({ command: "connect", socketPath });
        await client.waitFor("connected");

        // Client subscribes to a topic
        client.send({ command: "subscribe", channel: "jobs", topic: "task.#" });
        await client.waitFor("subscribed");

        // Small delay to ensure transport subscription is wired up
        await new Promise(r => setTimeout(r, 50));

        // Server publishes — should arrive at client via the socket transport
        server.send({
            command: "publish",
            channel: "jobs",
            topic: "task.created",
            data: { id: 1 },
        });
        await server.waitFor("published");

        await waitForCondition(() => client.collectEnvelopes().length >= 1);

        const received = client.collectEnvelopes();
        expect(received[0]!.envelope).toEqual({
            channel: "jobs",
            topic: "task.created",
            payload: { id: 1 },
        });
    });

    it("should deliver messages from client to server", async () => {
        const server = await spawnChild();
        children.push(server);
        const client = await spawnChild();
        children.push(client);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        client.send({ command: "connect", socketPath });
        await client.waitFor("connected");

        // Server subscribes
        server.send({ command: "subscribe", channel: "status", topic: "worker.ready" });
        await server.waitFor("subscribed");

        await new Promise(r => setTimeout(r, 50));

        // Client publishes
        client.send({
            command: "publish",
            channel: "status",
            topic: "worker.ready",
            data: { pid: 42 },
        });
        await client.waitFor("published");

        await waitForCondition(() => server.collectEnvelopes().length >= 1);

        const received = server.collectEnvelopes();
        expect(received[0]!.envelope).toEqual({
            channel: "status",
            topic: "worker.ready",
            payload: { pid: 42 },
        });
    });

    it("should fan out to multiple clients", async () => {
        const server = await spawnChild();
        children.push(server);
        const clientA = await spawnChild();
        children.push(clientA);
        const clientB = await spawnChild();
        children.push(clientB);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        clientA.send({ command: "connect", socketPath });
        await clientA.waitFor("connected");
        clientB.send({ command: "connect", socketPath });
        await clientB.waitFor("connected");

        clientA.send({ command: "subscribe", channel: "/", topic: "broadcast.#" });
        await clientA.waitFor("subscribed");
        clientB.send({ command: "subscribe", channel: "/", topic: "broadcast.#" });
        await clientB.waitFor("subscribed");

        await new Promise(r => setTimeout(r, 50));

        server.send({
            command: "publish",
            channel: "/",
            topic: "broadcast.hello",
            data: { msg: "hi all" },
        });
        await server.waitFor("published");

        await waitForCondition(
            () => clientA.collectEnvelopes().length >= 1 && clientB.collectEnvelopes().length >= 1
        );

        expect(clientA.collectEnvelopes()[0]!.envelope!.payload).toEqual({ msg: "hi all" });
        expect(clientB.collectEnvelopes()[0]!.envelope!.payload).toEqual({ msg: "hi all" });
    });

    it("should stop delivering to a disconnected client", async () => {
        const server = await spawnChild();
        children.push(server);
        const clientA = await spawnChild();
        children.push(clientA);
        const clientB = await spawnChild();
        children.push(clientB);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        clientA.send({ command: "connect", socketPath });
        await clientA.waitFor("connected");
        clientB.send({ command: "connect", socketPath });
        await clientB.waitFor("connected");

        clientA.send({ command: "subscribe", channel: "/", topic: "test.#" });
        await clientA.waitFor("subscribed");
        clientB.send({ command: "subscribe", channel: "/", topic: "test.#" });
        await clientB.waitFor("subscribed");

        await new Promise(r => setTimeout(r, 50));

        // First message — both should receive
        server.send({ command: "publish", channel: "/", topic: "test.one", data: { n: 1 } });
        await server.waitFor("published");

        await waitForCondition(
            () => clientA.collectEnvelopes().length >= 1 && clientB.collectEnvelopes().length >= 1
        );

        // Disconnect client A
        clientA.send({ command: "teardown" });
        await clientA.waitFor("torndown");

        // Give the server time to notice the disconnect
        await new Promise(r => setTimeout(r, 200));

        const beforeB = clientB.collectEnvelopes().length;

        // Second message — only client B should receive
        server.send({ command: "publish", channel: "/", topic: "test.two", data: { n: 2 } });
        await server.waitFor("published");

        await waitForCondition(() => clientB.collectEnvelopes().length > beforeB);

        const lastB = clientB.collectEnvelopes().at(-1)!;
        expect(lastB.envelope!.payload).toEqual({ n: 2 });

        // Client A should not have received the second message
        expect(clientA.collectEnvelopes()).toHaveLength(1);
    });

    it("should respect server filter — only forward matching envelopes", async () => {
        const server = await spawnChild();
        children.push(server);
        const client = await spawnChild();
        children.push(client);

        // Server only forwards jobs channel, task.# topics
        server.send({
            command: "listen",
            socketPath,
            filter: { channels: ["jobs"], topics: ["task.#"] },
        });
        await server.waitFor("listening");

        client.send({ command: "connect", socketPath });
        await client.waitFor("connected");

        // Subscribe broadly so we'd see anything that leaks through
        client.send({ command: "subscribe", channel: "jobs", topic: "#" });
        await client.waitFor("subscribed");
        client.send({ command: "subscribe", channel: "news", topic: "#" });
        await client.waitFor("subscribed");

        await new Promise(r => setTimeout(r, 50));

        // Matching message
        server.send({
            command: "publish",
            channel: "jobs",
            topic: "task.created",
            data: { id: 1 },
        });
        await server.waitFor("published");

        await waitForCondition(() => client.collectEnvelopes().length >= 1);
        expect(client.collectEnvelopes()[0]!.envelope!.topic).toBe("task.created");

        const countAfterMatch = client.collectEnvelopes().length;

        // Non-matching: wrong channel
        server.send({
            command: "publish",
            channel: "news",
            topic: "task.created",
            data: { id: 2 },
        });
        await server.waitFor("published");
        // Non-matching: wrong topic
        server.send({ command: "publish", channel: "jobs", topic: "alert.fired", data: { id: 3 } });
        await server.waitFor("published");

        // These should NOT arrive
        await new Promise(r => setTimeout(r, 300));
        expect(client.collectEnvelopes().length).toBe(countAfterMatch);
    });

    it("should fire onDisconnect when server disposes", async () => {
        const server = await spawnChild();
        children.push(server);
        const client = await spawnChild();
        children.push(client);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        client.send({ command: "connect", socketPath });
        await client.waitFor("connected");

        // Kill the server — client should report disconnected
        server.send({ command: "teardown" });
        await server.waitFor("torndown");

        await client.waitFor("disconnected");
    });

    it("should time out when a raw client never sends SYN", async () => {
        const server = await spawnChild();
        children.push(server);

        server.send({ command: "listen", socketPath, timeout: 150 });
        await server.waitFor("listening");

        // Connect a raw socket that never sends SYN
        const raw = net.connect(socketPath);

        const closed = new Promise<void>(resolve => {
            raw.on("close", () => resolve());
        });

        // Server should destroy the connection after ~150ms
        await closed;
        raw.destroy();
    });

    it("should handle many concurrent client connections", async () => {
        const server = await spawnChild();
        children.push(server);

        server.send({ command: "listen", socketPath });
        await server.waitFor("listening");

        const clientCount = 10;
        const clients = await Promise.all(Array.from({ length: clientCount }, () => spawnChild()));

        for (const c of clients) {
            children.push(c);
        }

        // Connect all clients in parallel
        await Promise.all(
            clients.map(async client => {
                client.send({ command: "connect", socketPath });
                await client.waitFor("connected");
            })
        );

        // All connected — now verify broadcast reaches all of them
        for (const client of clients) {
            client.send({ command: "subscribe", channel: "/", topic: "ping" });
            await client.waitFor("subscribed");
        }

        await new Promise(r => setTimeout(r, 50));

        server.send({ command: "publish", channel: "/", topic: "ping", data: { ts: 1 } });
        await server.waitFor("published");

        await waitForCondition(() => clients.every(c => c.collectEnvelopes().length >= 1), 5000);

        for (const client of clients) {
            expect(client.collectEnvelopes()[0]!.envelope!.payload).toEqual({ ts: 1 });
        }
    });

    it("should reject a client with wrong protocol version", async () => {
        const server = await spawnChild();
        children.push(server);

        server.send({ command: "listen", socketPath, timeout: 2000 });
        await server.waitFor("listening");

        const raw = net.connect(socketPath);

        const closed = new Promise<void>(resolve => {
            raw.on("close", () => resolve());
        });

        raw.on("connect", () => {
            raw.write(
                ndjsonSerializer.encode({
                    type: "postal:uds-syn",
                    version: 999,
                })
            );
        });

        const start = Date.now();
        await closed;
        const elapsed = Date.now() - start;

        // Should be way faster than the 2000ms timeout
        expect(elapsed).toBeLessThan(1000);
        raw.destroy();
    });
});
