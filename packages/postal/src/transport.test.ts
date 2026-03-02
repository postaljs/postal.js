export default {};

import {
    addTransport,
    resetTransports,
    type Transport,
    type Envelope,
    type TransportSendMeta,
} from "./index";
import { getChannel, createChannel, resetChannels, getInstanceId } from "./channel";
import { createEnvelope } from "./envelope";

// --- Mock transport factory ---

type SentCall = {
    envelope: Envelope;
    meta: TransportSendMeta | undefined;
};

type MockTransport = {
    transport: Transport;
    simulateInbound: (envelope: Envelope) => void;
    sentEnvelopes: Envelope[];
    sentCalls: SentCall[];
};

const createMockTransport = (): MockTransport => {
    let inboundCallback: ((envelope: Envelope) => void) | null = null;
    const sentEnvelopes: Envelope[] = [];
    const sentCalls: SentCall[] = [];

    const transport: Transport = {
        send: jest.fn((envelope: Envelope, meta?: TransportSendMeta) => {
            sentEnvelopes.push(envelope);
            sentCalls.push({ envelope, meta });
        }),
        subscribe: jest.fn((callback: (envelope: Envelope) => void) => {
            inboundCallback = callback;
            return () => {
                inboundCallback = null;
            };
        }),
        dispose: jest.fn(),
    };

    return {
        transport,
        simulateInbound: (envelope: Envelope) => {
            if (!inboundCallback) {
                throw new Error("Transport not subscribed — was it removed?");
            }
            inboundCallback(envelope);
        },
        sentEnvelopes,
        sentCalls,
    };
};

const CHANNEL_NAME = "orders";

describe("transport", () => {
    beforeEach(() => {
        resetChannels();
    });

    describe("addTransport", () => {
        describe("when publishing on a channel with a transport registered", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport);
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "HOVERBOARD-2015" });
            });

            it("should call transport.send", () => {
                expect(mock.transport.send).toHaveBeenCalledTimes(1);
            });

            it("should include correct envelope fields", () => {
                const sent = mock.sentEnvelopes[0];
                expect(sent.channel).toBe(CHANNEL_NAME);
                expect(sent.topic).toBe("item.placed");
                expect(sent.type).toBe("publish");
                expect(sent.payload).toEqual({ sku: "HOVERBOARD-2015" });
            });

            it("should stamp source on the outbound envelope", () => {
                const sent = mock.sentEnvelopes[0];
                expect(sent.source).toBe(getInstanceId());
            });
        });

        describe("when publishing with no transports registered", () => {
            it("should not throw", () => {
                const channel = getChannel(CHANNEL_NAME);
                expect(() => {
                    channel.publish("item.placed", { sku: "ALMANAC-1955" });
                }).not.toThrow();
            });
        });

        describe("when removing a transport via the returned function", () => {
            let mock: MockTransport;
            let remove: () => void;

            beforeEach(() => {
                mock = createMockTransport();
                remove = addTransport(mock.transport);
                remove();
            });

            it("should stop sending envelopes", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "PLUTONIUM" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });

            it("should call transport.dispose", () => {
                expect(mock.transport.dispose).toHaveBeenCalledTimes(1);
            });

            it("should be idempotent", () => {
                expect(() => {
                    remove();
                }).not.toThrow();
                expect(mock.transport.dispose).toHaveBeenCalledTimes(1);
            });
        });

        describe("when registering multiple transports", () => {
            let mockA: MockTransport;
            let mockB: MockTransport;

            beforeEach(() => {
                mockA = createMockTransport();
                mockB = createMockTransport();
                addTransport(mockA.transport);
                addTransport(mockB.transport);
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "MR-FUSION" });
            });

            it("should send to all transports", () => {
                expect(mockA.transport.send).toHaveBeenCalledTimes(1);
                expect(mockB.transport.send).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("TransportSendMeta peerCount", () => {
        describe("when a single transport is registered", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport);
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "LONE-WOLF" });
            });

            it("should call send with peerCount of 1", () => {
                expect(mock.sentCalls[0].meta?.peerCount).toBe(1);
            });
        });

        describe("when multiple transports are registered and all pass the filter", () => {
            let mockA: MockTransport;
            let mockB: MockTransport;
            let mockC: MockTransport;

            beforeEach(() => {
                mockA = createMockTransport();
                mockB = createMockTransport();
                mockC = createMockTransport();
                addTransport(mockA.transport);
                addTransport(mockB.transport);
                addTransport(mockC.transport);
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "THREE-MUSKETEERS" });
            });

            it("should call each transport send with peerCount of 3", () => {
                expect(mockA.sentCalls[0].meta?.peerCount).toBe(3);
                expect(mockB.sentCalls[0].meta?.peerCount).toBe(3);
                expect(mockC.sentCalls[0].meta?.peerCount).toBe(3);
            });
        });

        describe("when a channel filter excludes some transports", () => {
            let mockFiltered: MockTransport;
            let mockUnfiltered: MockTransport;

            beforeEach(() => {
                mockFiltered = createMockTransport();
                mockUnfiltered = createMockTransport();
                // This transport only accepts "inventory" channel — will not match "orders"
                addTransport(mockFiltered.transport, { filter: { channels: ["inventory"] } });
                addTransport(mockUnfiltered.transport);
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "MCFLY-SHOES" });
            });

            it("should not send to the filtered-out transport", () => {
                expect(mockFiltered.transport.send).not.toHaveBeenCalled();
            });

            it("should call the passing transport with peerCount of 1", () => {
                expect(mockUnfiltered.sentCalls[0].meta?.peerCount).toBe(1);
            });
        });
    });

    describe("echo prevention", () => {
        describe("when an inbound envelope has source matching the local instanceId", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const mock = createMockTransport();
                addTransport(mock.transport);
                callback = jest.fn();
                const channel = getChannel(CHANNEL_NAME);
                channel.subscribe("item.placed", callback);

                mock.simulateInbound(
                    createEnvelope({
                        type: "publish",
                        channel: CHANNEL_NAME,
                        topic: "item.placed",
                        payload: { sku: "ECHO" },
                        source: getInstanceId(),
                    })
                );
            });

            it("should not dispatch locally", () => {
                expect(callback).not.toHaveBeenCalled();
            });
        });

        describe("when an inbound envelope has a different source", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const mock = createMockTransport();
                addTransport(mock.transport);
                callback = jest.fn();
                const channel = getChannel(CHANNEL_NAME);
                channel.subscribe("item.placed", callback);

                mock.simulateInbound(
                    createEnvelope({
                        type: "publish",
                        channel: CHANNEL_NAME,
                        topic: "item.placed",
                        payload: { sku: "REMOTE" },
                        source: "remote-instance-id",
                    })
                );
            });

            it("should dispatch locally", () => {
                expect(callback).toHaveBeenCalledTimes(1);
            });
        });

        describe("when an inbound envelope has no source", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const mock = createMockTransport();
                addTransport(mock.transport);
                callback = jest.fn();
                const channel = getChannel(CHANNEL_NAME);
                channel.subscribe("item.placed", callback);

                mock.simulateInbound(
                    createEnvelope({
                        type: "publish",
                        channel: CHANNEL_NAME,
                        topic: "item.placed",
                        payload: { sku: "NO-SOURCE" },
                    })
                );
            });

            it("should dispatch locally", () => {
                expect(callback).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("filter", () => {
        describe("when a channel filter is configured", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport, {
                    filter: { channels: [CHANNEL_NAME] },
                });
            });

            it("should send envelopes on matching channels", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "MATCH" });
                expect(mock.transport.send).toHaveBeenCalledTimes(1);
            });

            it("should not send envelopes on non-matching channels", () => {
                const channel = getChannel("analytics");
                channel.publish("page.viewed", { url: "/home" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });

        describe("when a topic filter is configured", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport, {
                    filter: { topics: ["item.*"] },
                });
            });

            it("should send envelopes with matching topics", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "MATCH" });
                expect(mock.transport.send).toHaveBeenCalledTimes(1);
            });

            it("should not send envelopes with non-matching topics", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("user.created", { id: "DOC-BROWN" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });

        describe("when both channel and topic filters are configured", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport, {
                    filter: { channels: [CHANNEL_NAME], topics: ["item.#"] },
                });
            });

            it("should send when both match", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "BOTH" });
                expect(mock.transport.send).toHaveBeenCalledTimes(1);
            });

            it("should not send when channel matches but topic does not", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("user.created", { id: "MARTY" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });

            it("should not send when topic matches but channel does not", () => {
                const channel = getChannel("other");
                channel.publish("item.placed", { sku: "WRONG-CHANNEL" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });

        describe("when a reply envelope is sent and a filter is configured", () => {
            it("should bypass the filter", async () => {
                const mock = createMockTransport();
                addTransport(mock.transport, {
                    filter: { channels: [CHANNEL_NAME] },
                });

                // Handler replies go through the outbound hook as reply envelopes
                // on the __postal__.system channel — which wouldn't match the
                // channel filter. They must bypass filtering.
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 1.21 }));
                await channel.request("pricing.calculate", { sku: "FLUX-CAPACITOR" });

                // Should have sent both the request AND the reply
                const types = mock.sentEnvelopes.map(e => e.type);
                expect(types).toContain("request");
                expect(types).toContain("reply");
            });
        });

        describe("when a reply envelope is sent and a topic filter would block the reply topic", () => {
            let mock: MockTransport;

            beforeEach(async () => {
                mock = createMockTransport();
                // This topic filter only passes "order.*" — it would block
                // "system.rpc.response.*" (the reply topic) if replies weren't
                // exempt from topic filtering via the early-return in passesFilter.
                addTransport(mock.transport, {
                    filter: { topics: ["order.*"] },
                });

                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 88 }));
                await channel.request("pricing.calculate", { sku: "DELOREAN-DMC-12" });
            });

            it("should still forward the reply envelope", () => {
                const types = mock.sentEnvelopes.map(e => e.type);
                expect(types).toContain("reply");
            });
        });
    });

    describe("inbound dispatch", () => {
        describe("when receiving a publish envelope from a remote transport", () => {
            let callback: jest.Mock;

            beforeEach(() => {
                const mock = createMockTransport();
                addTransport(mock.transport);
                callback = jest.fn();
                const channel = getChannel(CHANNEL_NAME);
                channel.subscribe("item.placed", callback);

                mock.simulateInbound(
                    createEnvelope({
                        type: "publish",
                        channel: CHANNEL_NAME,
                        topic: "item.placed",
                        payload: { sku: "REMOTE-ITEM" },
                        source: "remote-id",
                    })
                );
            });

            it("should deliver to local subscribers", () => {
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback.mock.calls[0][0].payload).toEqual({ sku: "REMOTE-ITEM" });
            });
        });

        describe("when receiving a request envelope from a remote transport", () => {
            let handlerFn: jest.Mock;

            beforeEach(() => {
                const mock = createMockTransport();
                addTransport(mock.transport);
                handlerFn = jest.fn(() => ({ total: 88 }));
                const channel = getChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", handlerFn);

                mock.simulateInbound(
                    createEnvelope({
                        type: "request",
                        channel: CHANNEL_NAME,
                        topic: "pricing.calculate",
                        payload: { sku: "TIME-CIRCUITS" },
                        source: "remote-id",
                        replyTo: "system.rpc.response.remote-id",
                        correlationId: "corr-123",
                    })
                );
            });

            it("should invoke the local handler", () => {
                expect(handlerFn).toHaveBeenCalledTimes(1);
            });
        });

        describe("when receiving a reply envelope from a remote transport", () => {
            let result: unknown;

            beforeEach(async () => {
                const mock = createMockTransport();
                addTransport(mock.transport);

                const channel = getChannel(CHANNEL_NAME);
                const promise = channel.request("pricing.calculate", {
                    sku: "DELOREAN",
                });

                // Grab the outbound request to extract correlationId and replyTo
                const requestEnvelope = mock.sentEnvelopes.find(e => e.type === "request")!;

                // Simulate the remote handler's reply arriving
                mock.simulateInbound(
                    createEnvelope({
                        type: "reply",
                        channel: "__postal__.system",
                        topic: requestEnvelope.replyTo!,
                        payload: { success: true, payload: { total: 1.21 } },
                        correlationId: requestEnvelope.correlationId!,
                        source: "remote-id",
                    })
                );

                result = await promise;
            });

            it("should resolve the pending request", () => {
                expect(result).toEqual({ total: 1.21 });
            });
        });

        describe("when receiving an envelope for a channel that does not exist locally", () => {
            it("should not throw", () => {
                const mock = createMockTransport();
                addTransport(mock.transport);

                expect(() => {
                    mock.simulateInbound(
                        createEnvelope({
                            type: "publish",
                            channel: "nonexistent",
                            topic: "ghost.message",
                            payload: null,
                            source: "remote-id",
                        })
                    );
                }).not.toThrow();
            });
        });
    });

    describe("handler reply outbound", () => {
        describe("when a handler produces a success reply", () => {
            let mock: MockTransport;

            beforeEach(async () => {
                mock = createMockTransport();
                addTransport(mock.transport);

                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 1.21 }));
                await channel.request("pricing.calculate", { sku: "FLUX-CAPACITOR" });
            });

            it("should send the reply envelope through the transport", () => {
                const reply = mock.sentEnvelopes.find(e => e.type === "reply");
                expect(reply).toBeDefined();
                expect(reply!.payload).toEqual({
                    success: true,
                    payload: { total: 1.21 },
                });
            });
        });

        describe("when a handler throws an error", () => {
            let mock: MockTransport;

            beforeEach(async () => {
                mock = createMockTransport();
                addTransport(mock.transport);

                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    throw new Error("Great Scott!");
                });

                // Request will reject — catch it so the test doesn't fail
                try {
                    await channel.request("pricing.calculate", { sku: "BROKEN" });
                } catch {
                    // expected
                }
            });

            it("should send the error reply envelope through the transport", () => {
                const reply = mock.sentEnvelopes.find(e => e.type === "reply");
                expect(reply).toBeDefined();
                expect(reply!.payload).toEqual({
                    success: false,
                    payload: { message: "Great Scott!" },
                });
            });
        });
    });

    describe("cross-boundary RPC round-trip", () => {
        describe("when a local request is answered by a simulated remote handler", () => {
            let result: unknown;

            beforeEach(async () => {
                const mock = createMockTransport();
                addTransport(mock.transport);

                const channel = getChannel(CHANNEL_NAME);
                const promise = channel.request("pricing.calculate", {
                    sku: "TIME-MACHINE",
                });

                // Simulate the remote handler processing the request and replying
                const outbound = mock.sentEnvelopes.find(e => e.type === "request")!;

                mock.simulateInbound(
                    createEnvelope({
                        type: "reply",
                        channel: "__postal__.system",
                        topic: outbound.replyTo!,
                        payload: { success: true, payload: { total: 88 } },
                        correlationId: outbound.correlationId!,
                        source: "iframe-instance",
                    })
                );

                result = await promise;
            });

            it("should resolve with the remote handler's response", () => {
                expect(result).toEqual({ total: 88 });
            });
        });
    });

    describe("resetTransports", () => {
        describe("when called directly", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport);
                resetTransports();
            });

            it("should call dispose on the transport", () => {
                expect(mock.transport.dispose).toHaveBeenCalledTimes(1);
            });

            it("should stop sending outbound", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "POST-RESET" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });

        describe("when resetChannels is called", () => {
            let mock: MockTransport;

            beforeEach(() => {
                mock = createMockTransport();
                addTransport(mock.transport);
                resetChannels();
            });

            it("should also reset transports", () => {
                expect(mock.transport.dispose).toHaveBeenCalledTimes(1);
            });

            it("should stop sending outbound after reset", () => {
                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "POST-RESET" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });
    });

    describe("outbound hook lifecycle", () => {
        describe("when the last transport is removed", () => {
            it("should not call send on subsequent publishes", () => {
                const mock = createMockTransport();
                const remove = addTransport(mock.transport);
                remove();

                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "AFTER-REMOVE" });
                expect(mock.transport.send).not.toHaveBeenCalled();
            });
        });

        describe("when a transport is added after all were removed", () => {
            let mock: MockTransport;

            beforeEach(() => {
                const first = createMockTransport();
                const remove = addTransport(first.transport);
                remove();

                mock = createMockTransport();
                addTransport(mock.transport);

                const channel = getChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "RE-WIRED" });
            });

            it("should send to the new transport", () => {
                expect(mock.transport.send).toHaveBeenCalledTimes(1);
            });
        });
    });
});
