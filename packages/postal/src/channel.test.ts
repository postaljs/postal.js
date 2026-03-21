export default {};

import {
    createChannel,
    getChannel,
    resetChannels,
    PostalTimeoutError,
    PostalRpcError,
    PostalDisposedError,
    addWiretap,
    resetWiretaps,
    dispatchInbound,
    type Channel,
} from "./channel";
import type { Envelope } from "./envelope";

const CHANNEL_NAME = "orders";

describe("channel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetChannels();
    });

    describe("createChannel", () => {
        describe("subscribe and publish", () => {
            describe("when publishing to a topic with one exact-match subscriber", () => {
                let callback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callback = jest.fn();
                    channel.subscribe("item.placed", callback);
                    channel.publish("item.placed", { sku: "FLUX-CAPACITOR-MK1" });
                });

                it("should call the subscriber once", () => {
                    expect(callback).toHaveBeenCalledTimes(1);
                });

                it("should deliver an envelope with the correct channel, topic, and payload", () => {
                    expect(callback).toHaveBeenCalledWith(
                        expect.objectContaining({
                            type: "publish",
                            channel: CHANNEL_NAME,
                            topic: "item.placed",
                            payload: { sku: "FLUX-CAPACITOR-MK1" },
                        })
                    );
                });

                it("should include an id and timestamp on the envelope", () => {
                    const envelope: Envelope = callback.mock.calls[0][0];
                    expect(envelope.id).toMatch(
                        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                    );
                    expect(typeof envelope.timestamp).toBe("number");
                });
            });

            describe("when a subscriber uses a * wildcard pattern", () => {
                let callback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callback = jest.fn();
                    channel.subscribe("item.*", callback);
                    channel.publish("item.placed", { sku: "DL0R34N" });
                });

                it("should fire the subscriber", () => {
                    expect(callback).toHaveBeenCalledTimes(1);
                });

                it("should deliver the published topic, not the pattern", () => {
                    const envelope: Envelope = callback.mock.calls[0][0];
                    expect(envelope.topic).toBe("item.placed");
                });
            });

            describe("when a subscriber uses a # wildcard pattern", () => {
                let callback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callback = jest.fn();
                    channel.subscribe("item.#", callback);
                    channel.publish("item.placed.domestic.express", {});
                });

                it("should fire the subscriber", () => {
                    expect(callback).toHaveBeenCalledTimes(1);
                });
            });

            describe("when no subscribers match the published topic", () => {
                let callback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callback = jest.fn();
                    channel.subscribe("item.cancelled", callback);
                    channel.publish("item.placed", { sku: "HOVERBOARD-2015" });
                });

                it("should not call the subscriber", () => {
                    expect(callback).toHaveBeenCalledTimes(0);
                });
            });

            describe("when multiple subscribers match the same topic", () => {
                let callbackA: jest.Mock, callbackB: jest.Mock, callbackC: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callbackA = jest.fn();
                    callbackB = jest.fn();
                    callbackC = jest.fn();
                    channel.subscribe("item.placed", callbackA);
                    channel.subscribe("item.*", callbackB);
                    channel.subscribe("item.#", callbackC);
                    channel.publish("item.placed", { sku: "MR-FUSION" });
                });

                it("should call all matching subscribers", () => {
                    expect(callbackA).toHaveBeenCalledTimes(1);
                    expect(callbackB).toHaveBeenCalledTimes(1);
                    expect(callbackC).toHaveBeenCalledTimes(1);
                });

                it("should deliver the same envelope instance to each subscriber", () => {
                    const envelopeA = callbackA.mock.calls[0][0];
                    const envelopeB = callbackB.mock.calls[0][0];
                    const envelopeC = callbackC.mock.calls[0][0];
                    expect(envelopeA).toBe(envelopeB);
                    expect(envelopeB).toBe(envelopeC);
                });
            });

            describe("when publishing with no subscribers at all", () => {
                let publishFn: () => void;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    publishFn = () => {
                        channel.publish("item.placed", {});
                    };
                });

                it("should not throw", () => {
                    expect(publishFn).not.toThrow();
                });
            });
        });

        describe("unsubscribe", () => {
            describe("when unsubscribing before a publish", () => {
                let callback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    callback = jest.fn();
                    const unsub = channel.subscribe("item.placed", callback);
                    unsub();
                    channel.publish("item.placed", { sku: "SPORTS-ALMANAC-1950-2000" });
                });

                it("should not call the unsubscribed callback", () => {
                    expect(callback).toHaveBeenCalledTimes(0);
                });
            });

            describe("when calling unsubscribe twice", () => {
                let doubleFn: () => void;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    const unsub = channel.subscribe("item.placed", jest.fn());
                    unsub();
                    doubleFn = () => {
                        unsub();
                    };
                });

                it("should not throw", () => {
                    expect(doubleFn).not.toThrow();
                });
            });

            describe("when a subscriber unsubscribes itself during publish dispatch", () => {
                let secondCallback: jest.Mock;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    secondCallback = jest.fn();

                    // First subscriber removes itself mid-dispatch — the snapshot in
                    // dispatchEnvelope must prevent this mutation from skipping
                    // subscribers that appear after it in the original list.
                    let unsub: () => void;
                    unsub = channel.subscribe("item.placed", () => {
                        unsub();
                    });
                    channel.subscribe("item.placed", secondCallback);

                    channel.publish("item.placed", { sku: "TEMPORAL-PARADOX-MK1" });
                });

                it("should still invoke the second subscriber", () => {
                    expect(secondCallback).toHaveBeenCalledTimes(1);
                });
            });
        });

        describe("error isolation", () => {
            describe("when one subscriber throws and others do not", () => {
                let goodCallbackBefore: jest.Mock,
                    goodCallbackAfter: jest.Mock,
                    caughtError: unknown;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);
                    goodCallbackBefore = jest.fn();
                    goodCallbackAfter = jest.fn();

                    channel.subscribe("item.placed", goodCallbackBefore);
                    channel.subscribe("item.placed", () => {
                        throw new Error("E_FLUX_CAPACITOR_OVERLOAD");
                    });
                    channel.subscribe("item.placed", goodCallbackAfter);

                    try {
                        channel.publish("item.placed", { sku: "PLUTONIUM-CASE" });
                    } catch (err) {
                        caughtError = err;
                    }
                });

                it("should still call subscribers before and after the throwing one", () => {
                    expect(goodCallbackBefore).toHaveBeenCalledTimes(1);
                    expect(goodCallbackAfter).toHaveBeenCalledTimes(1);
                });

                it("should throw an AggregateError", () => {
                    expect(caughtError).toBeInstanceOf(AggregateError);
                });

                it("should include the original error in the AggregateError", () => {
                    const agg = caughtError as AggregateError;
                    expect(agg.errors).toHaveLength(1);
                    expect(agg.errors[0]).toBeInstanceOf(Error);
                    expect((agg.errors[0] as Error).message).toBe("E_FLUX_CAPACITOR_OVERLOAD");
                });
            });

            describe("when multiple subscribers throw", () => {
                let caughtError: unknown;

                beforeEach(() => {
                    const channel = createChannel(CHANNEL_NAME);

                    channel.subscribe("item.placed", () => {
                        throw new Error("E_TIMELINE_PARADOX");
                    });
                    channel.subscribe("item.placed", () => {
                        throw new Error("E_SPACE_TIME_CONTINUUM");
                    });

                    try {
                        channel.publish("item.placed", {});
                    } catch (err) {
                        caughtError = err;
                    }
                });

                it("should collect all errors in the AggregateError", () => {
                    const agg = caughtError as AggregateError;
                    expect(agg.errors).toHaveLength(2);
                    expect((agg.errors[0] as Error).message).toBe("E_TIMELINE_PARADOX");
                    expect((agg.errors[1] as Error).message).toBe("E_SPACE_TIME_CONTINUUM");
                });

                it("should include the count in the AggregateError message", () => {
                    const agg = caughtError as AggregateError;
                    expect(agg.message).toBe(
                        `2 subscriber(s) threw during publish to "${CHANNEL_NAME}/item.placed"`
                    );
                });
            });
        });
    });

    describe("handle", () => {
        describe("when registering a handler for a topic", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    return { total: 42 };
                });
                result = await channel.request("pricing.calculate", {
                    sku: "FLUX-CAPACITOR-MK1",
                });
            });

            it("should respond to requests on that topic", () => {
                expect(result).toEqual({ total: 42 });
            });
        });

        describe("when registering a duplicate handler for the same topic", () => {
            let registerFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 42 }));
                registerFn = () => {
                    channel.handle("pricing.calculate", () => ({ total: 99 }));
                };
            });

            it("should throw", () => {
                expect(registerFn).toThrow(
                    `Handler already registered for "pricing.calculate" on channel "${CHANNEL_NAME}"`
                );
            });
        });

        describe("when a handler is unregistered before a request", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                jest.useFakeTimers();
                const channel = createChannel(CHANNEL_NAME);
                const unhandle = channel.handle("pricing.calculate", () => ({
                    total: 42,
                }));
                unhandle();
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "DL0R34N" },
                    { timeout: 100 }
                );
                jest.advanceTimersByTime(100);
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("should time out because no handler exists", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalTimeoutError);
            });
        });

        describe("when calling unhandle twice", () => {
            let doubleFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                const unhandle = channel.handle("pricing.calculate", () => ({
                    total: 42,
                }));
                unhandle();
                doubleFn = () => {
                    unhandle();
                };
            });

            it("should not throw", () => {
                expect(doubleFn).not.toThrow();
            });
        });

        describe("when a publish is sent to the same topic as a handler", () => {
            let handlerCallback: jest.Mock;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                handlerCallback = jest.fn().mockReturnValue({ total: 42 });
                channel.handle("item.placed", handlerCallback);
                channel.publish("item.placed", { sku: "HOVERBOARD-2015" });
            });

            it("should not invoke the handler", () => {
                expect(handlerCallback).not.toHaveBeenCalled();
            });
        });
    });

    describe("request", () => {
        describe("when a handler returns a sync value", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    return { total: 1955 };
                });
                result = await channel.request("pricing.calculate", {
                    sku: "PLUTONIUM-CASE",
                });
            });

            it("should resolve with the handler's return value", () => {
                expect(result).toEqual({ total: 1955 });
            });
        });

        describe("when a handler returns an async value", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", async () => {
                    return { total: 88 };
                });
                result = await channel.request("pricing.calculate", {
                    sku: "MR-FUSION",
                });
            });

            it("should resolve with the handler's return value", () => {
                expect(result).toEqual({ total: 88 });
            });
        });

        describe("when no handler is registered", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                jest.useFakeTimers();
                const channel = createChannel(CHANNEL_NAME);
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "HOVERBOARD-2015" },
                    { timeout: 250 }
                );
                jest.advanceTimersByTime(250);
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("should reject with PostalTimeoutError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalTimeoutError);
            });

            it("should include channel, topic, and timeout on the error", async () => {
                try {
                    await requestPromise;
                } catch (err) {
                    const timeout = err as PostalTimeoutError;
                    expect(timeout.channel).toBe(CHANNEL_NAME);
                    expect(timeout.topic).toBe("pricing.calculate");
                    expect(timeout.timeout).toBe(250);
                }
            });
        });

        describe("when a handler throws synchronously", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    throw new Error("E_PRICE_GOUGING");
                });
                requestPromise = channel.request("pricing.calculate", {
                    sku: "SPORTS-ALMANAC-1950-2000",
                });
            });

            it("should reject with PostalRpcError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalRpcError);
            });

            it("should include the original error message", async () => {
                await expect(requestPromise).rejects.toThrow("E_PRICE_GOUGING");
            });
        });

        describe("when a handler returns a rejected promise", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", async () => {
                    throw new Error("E_MARKET_CRASH");
                });
                requestPromise = channel.request("pricing.calculate", {
                    sku: "BIFF_TANNEN_ENTERPRISES",
                });
            });

            it("should reject with PostalRpcError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalRpcError);
            });

            it("should include the rejection message", async () => {
                await expect(requestPromise).rejects.toThrow("E_MARKET_CRASH");
            });
        });

        describe("when a handler throws with a code property", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    const err = new Error("E_TEMPORAL_DISPLACEMENT");
                    (err as Error & { code: string }).code = "BTTF_1985";
                    throw err;
                });
                requestPromise = channel.request("pricing.calculate", {
                    sku: "CLOCK-TOWER-LIGHTNING",
                });
            });

            it("should reject with PostalRpcError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalRpcError);
            });

            it("should include the code on the error", async () => {
                await expect(requestPromise).rejects.toHaveProperty("code", "BTTF_1985");
            });

            it("should include the original error message", async () => {
                await expect(requestPromise).rejects.toThrow("E_TEMPORAL_DISPLACEMENT");
            });
        });

        describe("when a handler receives the request envelope", () => {
            let receivedEnvelope: Envelope;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", envelope => {
                    receivedEnvelope = envelope;
                    return { total: 42 };
                });
                await channel.request("pricing.calculate", {
                    sku: "DL0R34N",
                });
            });

            it("should have type 'request'", () => {
                expect(receivedEnvelope.type).toBe("request");
            });

            it("should include a replyTo topic with the instance GUID", () => {
                expect(receivedEnvelope.replyTo).toMatch(/^system\.rpc\.response\./);
            });

            it("should include a correlationId", () => {
                expect(receivedEnvelope.correlationId).toMatch(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                );
            });

            it("should include the correct channel, topic, and payload", () => {
                expect(receivedEnvelope.channel).toBe(CHANNEL_NAME);
                expect(receivedEnvelope.topic).toBe("pricing.calculate");
                expect(receivedEnvelope.payload).toEqual({ sku: "DL0R34N" });
            });
        });

        describe("when a regular subscriber is on the same topic as a handler", () => {
            let subscriberCallback: jest.Mock, result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                subscriberCallback = jest.fn();
                channel.subscribe("pricing.calculate", subscriberCallback);
                channel.handle("pricing.calculate", () => {
                    return { total: 42 };
                });
                result = await channel.request("pricing.calculate", {
                    sku: "TIME-CIRCUITS-MK1",
                });
            });

            it("should call the regular subscriber", () => {
                expect(subscriberCallback).toHaveBeenCalledTimes(1);
            });

            it("should deliver a request-type envelope to the regular subscriber", () => {
                expect(subscriberCallback).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: "request",
                        channel: CHANNEL_NAME,
                        topic: "pricing.calculate",
                        payload: { sku: "TIME-CIRCUITS-MK1" },
                    })
                );
            });

            it("should still resolve the request", () => {
                expect(result).toEqual({ total: 42 });
            });
        });

        describe("when a regular subscriber throws during request dispatch", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.subscribe("pricing.calculate", () => {
                    throw new Error("E_SUBSCRIBER_MELTDOWN");
                });
                channel.handle("pricing.calculate", () => {
                    return { total: 42 };
                });
                result = await channel.request("pricing.calculate", {
                    sku: "LIGHTNING-ROD",
                });
            });

            it("should still resolve with the handler's response", () => {
                expect(result).toEqual({ total: 42 });
            });
        });

        describe("when cleaning up after resolved requests", () => {
            it("should not reject stale correlation IDs on dispose after successful RPC", async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 42 }));

                // Complete several RPC calls
                await channel.request("pricing.calculate", { sku: "A" });
                await channel.request("pricing.calculate", { sku: "B" });
                await channel.request("pricing.calculate", { sku: "C" });

                // If pendingCorrelationIds leaked, dispose() would try to
                // reject promises that already resolved — which would be a
                // no-op but indicates the leak. We verify by checking that
                // dispose doesn't throw and no unhandled rejections fire.
                const rejectSpy = jest.fn();
                process.on("unhandledRejection", rejectSpy);

                channel.dispose();

                // Yield to let any stale rejections surface
                await new Promise(r => setTimeout(r, 0));

                process.removeListener("unhandledRejection", rejectSpy);
                expect(rejectSpy).not.toHaveBeenCalled();
            });

            it("should not reject stale correlation IDs on dispose after timed-out RPC", async () => {
                jest.useFakeTimers();
                const channel = createChannel(CHANNEL_NAME);
                // No handler registered — request will time out

                const requestPromise = channel.request(
                    "pricing.calculate",
                    {
                        sku: "TIMEOUT-ME",
                    },
                    { timeout: 100 }
                );

                jest.advanceTimersByTime(100);

                await expect(requestPromise).rejects.toThrow(PostalTimeoutError);

                // After timeout, disposing should have nothing to clean up
                const rejectSpy = jest.fn();
                process.on("unhandledRejection", rejectSpy);

                channel.dispose();

                jest.advanceTimersByTime(0);
                process.removeListener("unhandledRejection", rejectSpy);
                expect(rejectSpy).not.toHaveBeenCalled();

                jest.useRealTimers();
            });
        });

        describe("when timeout is 0 and a handler responds after a delay", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    return new Promise(resolve => {
                        setTimeout(() => resolve({ total: 8675309 }), 200);
                    });
                });
                result = await channel.request(
                    "pricing.calculate",
                    { sku: "ENCHANTMENT-UNDER-THE-SEA" },
                    { timeout: 0 }
                );
            });

            it("should resolve with the handler's response", () => {
                expect(result).toEqual({ total: 8675309 });
            });
        });

        describe("when timeout is 0 and the channel is disposed before a response", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                // No handler registered — request will hang until dispose
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "CLOCK-TOWER-LIGHTNING" },
                    { timeout: 0 }
                );
                channel.dispose();
            });

            it("should reject with PostalDisposedError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalDisposedError);
            });
        });

        describe("when timeout is 0 and resetChannels is called before a response", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                // No handler registered — request will hang until reset
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "SAVE-THE-CLOCK-TOWER" },
                    { timeout: 0 }
                );
                resetChannels();
            });

            it("should reject the pending request", async () => {
                await expect(requestPromise).rejects.toThrow(
                    "Channel registry reset while RPC request was pending"
                );
            });
        });
    });

    describe("PostalTimeoutError", () => {
        describe("when constructed", () => {
            let error: PostalTimeoutError;

            beforeEach(() => {
                error = new PostalTimeoutError(CHANNEL_NAME, "pricing.calculate", 5000);
            });

            it("should be an instance of Error", () => {
                expect(error).toBeInstanceOf(Error);
            });

            it("should have the correct name", () => {
                expect(error.name).toBe("PostalTimeoutError");
            });

            it("should include channel, topic, and timeout in the message", () => {
                expect(error.message).toBe(
                    `Request to "${CHANNEL_NAME}/pricing.calculate" timed out after 5000ms`
                );
            });

            it("should expose channel, topic, and timeout properties", () => {
                expect(error.channel).toBe(CHANNEL_NAME);
                expect(error.topic).toBe("pricing.calculate");
                expect(error.timeout).toBe(5000);
            });
        });
    });

    describe("PostalRpcError", () => {
        describe("when constructed with message only", () => {
            let error: PostalRpcError;

            beforeEach(() => {
                error = new PostalRpcError("E_FLUX_CAPACITOR_OVERLOAD");
            });

            it("should be an instance of Error", () => {
                expect(error).toBeInstanceOf(Error);
            });

            it("should have the correct name", () => {
                expect(error.name).toBe("PostalRpcError");
            });

            it("should include the message", () => {
                expect(error.message).toBe("E_FLUX_CAPACITOR_OVERLOAD");
            });

            it("should not have a code property", () => {
                expect(error.code).toBeUndefined();
            });
        });

        describe("when constructed with message and code", () => {
            let error: PostalRpcError;

            beforeEach(() => {
                error = new PostalRpcError("E_PLUTONIUM_SHORTAGE", "BTTF_1985");
            });

            it("should include the message", () => {
                expect(error.message).toBe("E_PLUTONIUM_SHORTAGE");
            });

            it("should include the code", () => {
                expect(error.code).toBe("BTTF_1985");
            });
        });
    });

    describe("PostalDisposedError", () => {
        describe("when constructed", () => {
            let error: PostalDisposedError;

            beforeEach(() => {
                error = new PostalDisposedError(CHANNEL_NAME);
            });

            it("should be an instance of Error", () => {
                expect(error).toBeInstanceOf(Error);
            });

            it("should have the correct name", () => {
                expect(error.name).toBe("PostalDisposedError");
            });

            it("should include the channel name in the message", () => {
                expect(error.message).toBe(`Channel "${CHANNEL_NAME}" has been disposed`);
            });

            it("should expose the channel property", () => {
                expect(error.channel).toBe(CHANNEL_NAME);
            });
        });
    });

    describe("dispose", () => {
        describe("when disposing a channel from the registry", () => {
            let staleRef: Channel, freshRef: Channel;

            beforeEach(() => {
                staleRef = getChannel(CHANNEL_NAME);
                staleRef.dispose();
                freshRef = getChannel(CHANNEL_NAME);
            });

            it("should return a new instance from getChannel after dispose", () => {
                expect(staleRef).not.toBe(freshRef);
            });

            it("should still expose the name on the disposed channel", () => {
                expect(staleRef.name).toBe(CHANNEL_NAME);
            });
        });

        describe("when calling dispose twice", () => {
            let disposeFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.dispose();
                disposeFn = () => {
                    channel.dispose();
                };
            });

            it("should not throw", () => {
                expect(disposeFn).not.toThrow();
            });
        });

        describe("when publishing after dispose", () => {
            let publishFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.dispose();
                publishFn = () => {
                    channel.publish("item.placed", { sku: "DL0R34N" });
                };
            });

            it("should throw PostalDisposedError", () => {
                expect(publishFn).toThrow(PostalDisposedError);
            });
        });

        describe("when subscribing after dispose", () => {
            let subscribeFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.dispose();
                subscribeFn = () => {
                    channel.subscribe("item.placed", jest.fn());
                };
            });

            it("should throw PostalDisposedError", () => {
                expect(subscribeFn).toThrow(PostalDisposedError);
            });
        });

        describe("when requesting after dispose", () => {
            let requestFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.dispose();
                requestFn = () => {
                    channel.request("pricing.calculate", { sku: "FLUX-CAPACITOR-MK1" });
                };
            });

            it("should throw PostalDisposedError", () => {
                expect(requestFn).toThrow(PostalDisposedError);
            });
        });

        describe("when registering a handler after dispose", () => {
            let handleFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.dispose();
                handleFn = () => {
                    channel.handle("pricing.calculate", () => ({ total: 42 }));
                };
            });

            it("should throw PostalDisposedError", () => {
                expect(handleFn).toThrow(PostalDisposedError);
            });
        });

        describe("when calling unsubscribe after dispose", () => {
            let unsubFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                const unsub = channel.subscribe("item.placed", jest.fn());
                channel.dispose();
                unsubFn = () => {
                    unsub();
                };
            });

            it("should not throw", () => {
                expect(unsubFn).not.toThrow();
            });
        });

        describe("when calling unhandle after dispose", () => {
            let unhandleFn: () => void;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                const unhandle = channel.handle("pricing.calculate", () => ({ total: 42 }));
                channel.dispose();
                unhandleFn = () => {
                    unhandle();
                };
            });

            it("should not throw", () => {
                expect(unhandleFn).not.toThrow();
            });
        });

        describe("when disposing a channel with a pending RPC request", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                jest.useFakeTimers();
                const channel = createChannel(CHANNEL_NAME);
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "CLOCK-TOWER-LIGHTNING" },
                    { timeout: 5000 }
                );
                channel.dispose();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("should reject with PostalDisposedError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalDisposedError);
            });
        });
    });

    describe("resetChannels + dispose integration", () => {
        describe("when using a stale channel reference after reset", () => {
            let staleRef: Channel;

            beforeEach(() => {
                staleRef = getChannel(CHANNEL_NAME);
                resetChannels();
            });

            it("should throw PostalDisposedError on publish", () => {
                expect(() => {
                    staleRef.publish("item.placed", {});
                }).toThrow(PostalDisposedError);
            });
        });

        describe("when getting a channel after reset", () => {
            let freshRef: Channel;

            beforeEach(() => {
                getChannel(CHANNEL_NAME);
                resetChannels();
                freshRef = getChannel(CHANNEL_NAME);
            });

            it("should return a working channel", () => {
                const callback = jest.fn();
                freshRef.subscribe("item.placed", callback);
                freshRef.publish("item.placed", { sku: "MR-FUSION" });
                expect(callback).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe("getChannel", () => {
        describe("when getting a channel for the first time", () => {
            let channel: Channel;

            beforeEach(() => {
                channel = getChannel(CHANNEL_NAME);
            });

            it("should return a channel with the given name", () => {
                expect(channel.name).toBe(CHANNEL_NAME);
            });
        });

        describe("when getting the same channel name twice", () => {
            let first: Channel, second: Channel;

            beforeEach(() => {
                first = getChannel(CHANNEL_NAME);
                second = getChannel(CHANNEL_NAME);
            });

            it("should return the same instance", () => {
                expect(first).toBe(second);
            });
        });

        describe("when called without a name", () => {
            it("should default to the '__default__' channel", () => {
                const channel = getChannel();
                expect(channel.name).toBe("__default__");
            });

            it("should return the same instance as getChannel('__default__')", () => {
                const implicit = getChannel();
                const explicit = getChannel("__default__");
                expect(implicit).toBe(explicit);
            });
        });

        describe("when getting channels with different names", () => {
            let orders: Channel, shipping: Channel;

            beforeEach(() => {
                orders = getChannel("orders");
                shipping = getChannel("shipping");
            });

            it("should return different instances", () => {
                expect(orders).not.toBe(shipping);
            });

            it("should assign the correct name to each", () => {
                expect(orders.name).toBe("orders");
                expect(shipping.name).toBe("shipping");
            });
        });
    });

    describe("resetChannels", () => {
        describe("when resetting after creating channels", () => {
            let before: Channel, after: Channel;

            beforeEach(() => {
                before = getChannel(CHANNEL_NAME);
                resetChannels();
                after = getChannel(CHANNEL_NAME);
            });

            it("should return a new instance after reset", () => {
                expect(before).not.toBe(after);
            });
        });

        describe("when resetting with a pending RPC request", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                jest.useFakeTimers();
                const channel = createChannel(CHANNEL_NAME);
                requestPromise = channel.request(
                    "pricing.calculate",
                    { sku: "CLOCK-TOWER-LIGHTNING" },
                    { timeout: 5000 }
                );
                // Reset while the request is still pending
                resetChannels();
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it("should reject the pending request", async () => {
                await expect(requestPromise).rejects.toThrow(
                    "Channel registry reset while RPC request was pending"
                );
            });
        });
    });

    describe("wiretap", () => {
        afterEach(() => {
            resetWiretaps();
        });

        describe("when a wiretap is registered and a message is published", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                addWiretap(tap);

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "FLUX-CAPACITOR" });
            });

            it("should invoke the wiretap with the published envelope", () => {
                expect(tap).toHaveBeenCalledTimes(1);
                expect(tap.mock.calls[0][0]).toMatchObject({
                    type: "publish",
                    channel: CHANNEL_NAME,
                    topic: "item.placed",
                    payload: { sku: "FLUX-CAPACITOR" },
                });
            });
        });

        describe("when a wiretap is registered and a request is made", () => {
            let tap: jest.Mock;

            beforeEach(async () => {
                tap = jest.fn();
                addWiretap(tap);

                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => ({ total: 88 }));
                await channel.request("pricing.calculate", { sku: "DELOREAN" });
            });

            it("should see the request envelope", () => {
                const request = tap.mock.calls.find(([env]: [Envelope]) => env.type === "request");
                expect(request).toBeDefined();
                expect(request![0]).toMatchObject({
                    type: "request",
                    channel: CHANNEL_NAME,
                    topic: "pricing.calculate",
                });
            });

            it("should see the reply envelope", () => {
                const reply = tap.mock.calls.find(([env]: [Envelope]) => env.type === "reply");
                expect(reply).toBeDefined();
                expect(reply![0]).toMatchObject({
                    type: "reply",
                    payload: { success: true, payload: { total: 88 } },
                });
            });
        });

        describe("when a handler throws and a wiretap is registered", () => {
            let tap: jest.Mock;

            beforeEach(async () => {
                tap = jest.fn();
                addWiretap(tap);

                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    throw new Error("Great Scott!");
                });

                try {
                    await channel.request("pricing.calculate", { sku: "BROKEN" });
                } catch {
                    // expected
                }
            });

            it("should see the error reply envelope", () => {
                const reply = tap.mock.calls.find(([env]: [Envelope]) => env.type === "reply");
                expect(reply).toBeDefined();
                expect(reply![0]).toMatchObject({
                    type: "reply",
                    payload: { success: false, payload: { message: "Great Scott!" } },
                });
            });
        });

        describe("when multiple wiretaps are registered", () => {
            let tap1: jest.Mock, tap2: jest.Mock;

            beforeEach(() => {
                tap1 = jest.fn();
                tap2 = jest.fn();
                addWiretap(tap1);
                addWiretap(tap2);

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "HOVERBOARD" });
            });

            it("should invoke all wiretaps", () => {
                expect(tap1).toHaveBeenCalledTimes(1);
                expect(tap2).toHaveBeenCalledTimes(1);
            });
        });

        describe("when a wiretap is removed via its unsubscribe function", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                const unsub = addWiretap(tap);
                unsub();

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "HOVERBOARD" });
            });

            it("should no longer receive envelopes", () => {
                expect(tap).not.toHaveBeenCalled();
            });
        });

        describe("when the unsubscribe function is called twice", () => {
            let doubleFn: () => void;

            beforeEach(() => {
                const unsub = addWiretap(jest.fn());
                unsub();
                doubleFn = () => {
                    unsub();
                };
            });

            it("should not throw", () => {
                expect(doubleFn).not.toThrow();
            });
        });

        describe("when a wiretap throws", () => {
            let publishFn: () => void;

            beforeEach(() => {
                addWiretap(() => {
                    throw new Error("wiretap exploded");
                });

                const channel = createChannel(CHANNEL_NAME);
                publishFn = () => {
                    channel.publish("item.placed", { sku: "SPORTS-ALMANAC" });
                };
            });

            it("should not break the publish", () => {
                expect(publishFn).not.toThrow();
            });
        });

        describe("when a throwing wiretap is followed by a healthy one", () => {
            let healthyTap: jest.Mock;

            beforeEach(() => {
                addWiretap(() => {
                    throw new Error("boom");
                });
                healthyTap = jest.fn();
                addWiretap(healthyTap);

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "SPORTS-ALMANAC" });
            });

            it("should still invoke the healthy wiretap", () => {
                expect(healthyTap).toHaveBeenCalledTimes(1);
            });
        });

        describe("when an inbound envelope is dispatched", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                addWiretap(tap);

                // Create the channel so dispatchInbound has a target
                const channel = createChannel(CHANNEL_NAME);
                channel.subscribe("item.placed", jest.fn());

                dispatchInbound({
                    id: "remote-123",
                    type: "publish",
                    channel: CHANNEL_NAME,
                    topic: "item.placed",
                    payload: { sku: "REMOTE-WIDGET" },
                    timestamp: Date.now(),
                    source: "remote-instance",
                });
            });

            it("should invoke the wiretap with the inbound envelope", () => {
                expect(tap).toHaveBeenCalledTimes(1);
                expect(tap.mock.calls[0][0]).toMatchObject({
                    type: "publish",
                    channel: CHANNEL_NAME,
                    topic: "item.placed",
                    payload: { sku: "REMOTE-WIDGET" },
                    source: "remote-instance",
                });
            });
        });

        describe("when resetWiretaps is called", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                addWiretap(tap);
                resetWiretaps();

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "PLUTONIUM" });
            });

            it("should no longer invoke cleared wiretaps", () => {
                expect(tap).not.toHaveBeenCalled();
            });
        });

        describe("when resetChannels is called", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                addWiretap(tap);
                resetChannels();

                // tap.mockClear so we only count calls after reset
                tap.mockClear();

                const channel = createChannel(CHANNEL_NAME);
                channel.publish("item.placed", { sku: "PLUTONIUM" });
            });

            it("should also clear wiretaps", () => {
                expect(tap).not.toHaveBeenCalled();
            });
        });
    });

    describe("request with negative timeout", () => {
        describe("when timeout is a negative value", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    return new Promise(resolve => {
                        setTimeout(() => resolve({ total: 1985 }), 150);
                    });
                });
                result = await channel.request(
                    "pricing.calculate",
                    { sku: "ENCHANTMENT-UNDER-THE-SEA-DANCE" },
                    { timeout: -1 }
                );
            });

            it("should resolve instead of timing out immediately", () => {
                expect(result).toEqual({ total: 1985 });
            });
        });
    });

    describe("handle error path with non-Error throw", () => {
        describe("when a handler throws a string instead of an Error", () => {
            let requestPromise: Promise<unknown>;

            beforeEach(() => {
                const channel = createChannel(CHANNEL_NAME);
                channel.handle("pricing.calculate", () => {
                    // eslint-disable-next-line no-throw-literal
                    throw "E_BIFF_STOLE_THE_ALMANAC";
                });
                requestPromise = channel.request("pricing.calculate", {
                    sku: "SPORTS-ALMANAC-1950-2000",
                });
            });

            it("should reject with PostalRpcError", async () => {
                await expect(requestPromise).rejects.toBeInstanceOf(PostalRpcError);
            });

            it("should stringify the thrown value as the error message", async () => {
                await expect(requestPromise).rejects.toThrow("E_BIFF_STOLE_THE_ALMANAC");
            });
        });
    });

    describe("dispatchInbound", () => {
        describe("when a publish envelope targets a non-existent channel", () => {
            let tap: jest.Mock;

            beforeEach(() => {
                tap = jest.fn();
                addWiretap(tap);

                dispatchInbound({
                    id: "ghost-456",
                    type: "publish",
                    channel: "non-existent-channel",
                    topic: "item.placed",
                    payload: { sku: "PHANTOM-WIDGET" },
                    timestamp: Date.now(),
                    source: "remote-instance",
                });
            });

            it("should still invoke wiretaps", () => {
                expect(tap).toHaveBeenCalledTimes(1);
                expect(tap.mock.calls[0][0]).toMatchObject({
                    type: "publish",
                    channel: "non-existent-channel",
                    topic: "item.placed",
                    payload: { sku: "PHANTOM-WIDGET" },
                });
            });
        });

        describe("when a reply envelope is dispatched inbound for an RPC flow", () => {
            let result: unknown;

            beforeEach(async () => {
                const channel = createChannel(CHANNEL_NAME);
                let capturedCorrelationId: string;
                let capturedReplyTo: string;

                channel.subscribe("pricing.calculate", (env: Envelope) => {
                    capturedCorrelationId = env.correlationId!;
                    capturedReplyTo = env.replyTo!;
                });

                const promise = channel.request(
                    "pricing.calculate",
                    { sku: "REMOTE-DELOREAN" },
                    { timeout: 0 }
                );

                // Allow the request dispatch to complete
                await new Promise(r => setTimeout(r, 0));

                // Simulate a remote handler reply arriving via transport
                dispatchInbound({
                    id: "remote-reply-789",
                    type: "reply",
                    channel: "__postal__.system",
                    topic: capturedReplyTo!,
                    payload: { success: true, payload: { total: 88 } },
                    timestamp: Date.now(),
                    correlationId: capturedCorrelationId!,
                });

                result = await promise;
            });

            it("should resolve the pending request via the inbound reply", () => {
                expect(result).toEqual({ total: 88 });
            });
        });
    });

    describe("type-level constraints", () => {
        type TestRpcMap = {
            "order.created": { id: string };
            "order.get": { request: { id: string }; response: { total: number } };
        };

        it("should exclude RPC topics from publish at compile time", () => {
            const ch = createChannel<TestRpcMap>("test");
            // @ts-expect-error — RPC topic "order.get" is not publishable
            ch.publish("order.get", { request: { id: "1" }, response: { total: 1 } });
        });

        it("should exclude pub/sub topics from request at compile time", () => {
            const ch = createChannel<TestRpcMap>("test");
            // @ts-expect-error — pub/sub topic "order.created" is not requestable
            void ch.request("order.created", { id: "1" }).catch(() => {});
        });

        it("should allow publish on pub/sub topics", () => {
            const ch = createChannel<TestRpcMap>("test");
            ch.publish("order.created", { id: "BTTF-1985" });
        });

        it("should allow request on RPC topics and infer response type", async () => {
            const ch = createChannel<TestRpcMap>("test");
            ch.handle("order.get", () => {
                return { total: 121 };
            });
            const result = await ch.request("order.get", { id: "BTTF-1985" });
            expect(result).toEqual({ total: 121 });
        });
    });
});
