/* global describe, postal, it, after, before, expect */
(function(global) {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("lodash") : window._;
    var subscription;
    var sub;
    var channel;
    var caughtSubscribeEvent = false;
    var caughtUnsubscribeEvent = false;

    describe("noConflict", function() {
        it("should return control to the previous postal value", function() {
            if (typeof window === "undefined" || (typeof window !== "undefined" && typeof require === "function" && define.amd)) {
                var err = false;
                try {
                    postal.noConflict();
                } catch (e) {
                    err = true;
                }
                expect(err).to.be(true);
            } else {
                var _postal = global.postal; // hang on to postal value
                postal.noConflict(); // return previous postal
                expect(global.postal.foo).to.be("bar");
                global.postal = _postal; // return postal back as it was
            }
        });
    });

    describe("subscription creation", function() {
        describe("When creating basic subscription", function() {
            var systemSubscription = {};
            before(function() {
                systemSubscription = postal.subscribe({
                    channel: "postal",
                    topic: "subscription.created",
                    callback: function(data, envelope) {
                        if (data.event &&
                            data.event === "subscription.created" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic") {
                            caughtSubscribeEvent = true;
                        }
                    }
                });
                subscription = postal.channel("MyChannel").subscribe("MyTopic", function() {});
                sub = postal.subscriptions.MyChannel.MyTopic[0];
            });
            after(function() {
                systemSubscription.unsubscribe();
                postal.reset();
            });
            it("should create a channel called MyChannel", function() {
                expect(postal.subscriptions["MyChannel"] !== undefined).to.be.ok();
            });
            it("should create a topic under MyChannel called MyTopic", function() {
                expect(postal.subscriptions["MyChannel"]["MyTopic"] !== undefined).to.be.ok();
            });
            it("should have set subscription channel value", function() {
                expect(sub.channel).to.be("MyChannel");
            });
            it("should have set subscription topic value", function() {
                expect(sub.topic).to.be("MyTopic");
            });
            it("should have captured subscription creation event", function() {
                expect(caughtSubscribeEvent).to.be.ok();
            });
        });
        describe("When subscribing with a hierarchical binding, no wildcards", function() {
            var count = 0,
                channelB, channelC;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic.MiddleTopic", function(data) {
                    count++;
                });
                channel.publish("MyTopic.MiddleTopic.SubTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123");
            });
            after(function() {
                postal.reset();
                count = 0;
            });
            it("should have invoked subscription callback only once", function() {
                expect(count).to.be(1);
            });
        });
        describe("When subscribing with a hierarchical binding, using #", function() {
            var count, channelB, channelC, channelD, channelE;
            before(function() {
                count = 0;
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic.#.SubTopic", function(data, env) {
                    count++;
                });
                channel.publish("MyTopic.MiddleTopic.SubTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubMiddle.SubTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123");
            });
            after(function() {
                postal.reset();
                count = 0;
            });
            it("should have invoked subscription callback twice", function() {
                expect(count).to.be(2);
            });
        });
        describe("When subscribing with a hierarchical binding, using *", function() {
            var count = 0,
                channelB, channelC, channelD;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic.MiddleTopic.*", function(data) {
                    count++;
                });

                channel.publish("MyTopic.MiddleTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123");
            });
            after(function() {
                postal.reset();
                count = 0;
            });
            it("should have invoked subscription callback twice", function() {
                expect(count).to.be(1);
            });
        });
        describe("When subscribing with a hierarchical binding, using # and *", function() {
            var count = 0,
                channelB, channelC, channelD, channelE;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic.#.*", function(data) {
                    count++;
                });

                channel.publish("MyTopic.MiddleTopic.SubTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic", "Testing123");
                channel.publish("MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123");
                channel.publish("OtherTopic.MiddleTopic.SubTopic.YetAnother", "Testing123");
            });
            after(function() {
                postal.reset();
                count = 0;
            });
            it("should have invoked subscription callback twice", function() {
                expect(count).to.be(3);
            });
        });
        describe("When subscribing with the context being set", function() {
            var count = 0,
                obj = {
                    increment: function() {
                        count++;
                    }
                };
            before(function() {
                channel = postal.channel("ContextChannel");
                subscription = channel.subscribe("MyTopic", function(data) {
                    this.increment();
                }).withContext(obj);
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
            });
            it("should have called obj.increment", function() {
                expect(count).to.be(1);
            });
        });
        describe("When using global subscribe api", function() {
            before(function() {
                subscription = postal.subscribe({
                    channel: "MyChannel",
                    topic: "MyTopic",
                    callback: function() {}
                });
                sub = postal.subscriptions.MyChannel.MyTopic[0];
            });
            after(function() {
                postal.reset();
            });
            it("subscription should be of type SubscriptionDefinition", function() {
                expect(subscription instanceof postal.SubscriptionDefinition).to.be.ok();
            });
            it("should create an channel called MyChannel", function() {
                expect(postal.subscriptions["MyChannel"] !== undefined).to.be.ok();
            });
            it("should create a topic under MyChannel called MyTopic", function() {
                expect(postal.subscriptions["MyChannel"]["MyTopic"] !== undefined).to.be.ok();
            });
            it("should have set subscription channel value", function() {
                expect(sub.channel).to.be("MyChannel");
            });
            it("should have set subscription topic value", function() {
                expect(sub.topic).to.be("MyTopic");
            });
        });
    });

    describe("publishing", function() {
        describe("When publishing a message", function() {
            var msgReceivedCnt = 0,
                msgData;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function(data) {
                    msgReceivedCnt++;
                    msgData = data;
                });
                channel.publish("MyTopic", "Testing123");
                subscription.unsubscribe();
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
            });
            it("subscription callback should be invoked once", function() {
                expect(msgReceivedCnt).to.be(1);
            });
            it("subscription callback should receive published data", function() {
                expect(msgData).to.be("Testing123");
            });
        });
        describe("When using global publish api", function() {
            var msgReceivedCnt = 0,
                msgData;
            before(function() {
                channel = postal.channel("MyGlobalChannel");
                subscription = channel.subscribe("MyTopic", function(data) {
                    msgReceivedCnt++;
                    msgData = data;
                });
                postal.publish({
                    channel: "MyGlobalChannel",
                    topic: "MyTopic",
                    data: "Testing123"
                });
                subscription.unsubscribe();
                postal.publish({
                    channel: "MyGlobalChannel",
                    topic: "MyTopic",
                    data: "Testing123"
                });
            });
            after(function() {
                postal.reset();
                msgReceivedCnt = 0;
            });
            it("channel should be of type ChannelDefinition", function() {
                expect(channel instanceof postal.ChannelDefinition).to.be.ok();
            });
            it("subscription callback should be invoked once", function() {
                expect(msgReceivedCnt).to.be(1);
            });
            it("subscription callback should receive published data", function() {
                expect(msgData).to.be("Testing123");
            });
        });
    });

    describe("unsubscribing", function() {
        describe("With a single subscription", function() {
            var subExistsBefore = false,
                subExistsAfter = true;
            var systemSubscription = {};
            beforeEach(function() {
                systemSubscription = postal.subscribe({
                    channel: "postal",
                    topic: "subscription.*",
                    callback: function(data, env) {
                        if (data.event &&
                            data.event === "subscription.removed" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic") {
                            caughtUnsubscribeEvent = true;
                        }
                    }
                });
                subscription = postal.channel("MyChannel").subscribe("MyTopic", function() {});
                subExistsBefore = postal.subscriptions.MyChannel.MyTopic[0] !== undefined;
                subscription.unsubscribe();
                subExistsAfter = postal.subscriptions.MyChannel.MyTopic.length !== 0;
            });
            afterEach(function() {
                systemSubscription.unsubscribe();
                postal.reset();
            });
            it("subscription should exist before unsubscribe", function() {
                expect(subExistsBefore).to.be.ok();
            });
            it("subscription should not exist after unsubscribe", function() {
                expect(subExistsAfter).to.not.be.ok();
            });
            it("should have captured unsubscription creation event", function() {
                expect(caughtUnsubscribeEvent).to.be.ok();
            });
            it("postal.getSubscribersFor('MyChannel', 'MyTopic') should not return any subscriptions", function() {
                expect(postal.getSubscribersFor("MyChannel", "MyTopic").length).to.be(0);
            });
        });
        describe("With multiple subscriptions", function() {
            var subsExistsBefore, subsExistsAfter, unsubscribeMsgs, sub2;
            var systemSubscription = {};
            before(function() {
                subsExistsBefore = false;
                subsExistsAfter = true;
                unsubscribeMsgs = 0;
                systemSubscription = postal.subscribe({
                    channel: "postal",
                    topic: "subscription.*",
                    callback: function(data, env) {
                        if (data.event &&
                            data.event === "subscription.removed" &&
                            data.channel === "MyChannel") {
                            unsubscribeMsgs += 1;
                        }
                    }
                });
                subscription = postal.channel("MyChannel").subscribe("MyTopic", function() {});
                sub2 = postal.channel("MyChannel").subscribe("MyTopic2", function() {});
                subExistsBefore = postal.subscriptions.MyChannel.MyTopic[0] !== undefined;
                subscription.unsubscribe();
                subExistsAfter = postal.subscriptions.MyChannel.MyTopic.length !== 0;
            });
            after(function() {
                systemSubscription.unsubscribe();
                postal.reset();
            });
            it("subscription should exist before unsubscribe", function() {
                expect(subExistsBefore).to.be.ok();
            });
            it("subscription should not exist after unsubscribe", function() {
                expect(subExistsAfter).to.not.be.ok();
            });
            it("should have captured unsubscription creation event", function() {
                expect(unsubscribeMsgs).to.be(1);
            });
            it("postal.getSubscribersFor('MyChannel', 'MyTopic') should not return any subscriptions", function() {
                expect(postal.getSubscribersFor("MyChannel", "MyTopic").length).to.be(0);
            });
        });


    });

    describe("wiretaps", function() {
        describe("When subscribing and unsubscribing a wire tap", function() {
            var wireTapData,
                wireTapEnvelope,
                wiretap;
            before(function() {
                caughtUnsubscribeEvent = false;
                wireTapData = [];
                wireTapEnvelope = [];
                wiretap = postal.addWireTap(function(msg, envelope) {
                    wireTapData.push(msg);
                    wireTapEnvelope.push(envelope);
                });
                postal.publish({
                    topic: "Oh.Hai.There",
                    data: "I'm in yer bus, tappin' yer subscriptionz..."
                });
                wiretap();
                postal.publish({
                    topic: "Oh.Hai.There",
                    data: "I'm in yer bus, tappin' yer subscriptionz..."
                });
            });
            after(function() {
                postal.reset();
            });
            it("wire tap should have been invoked only once", function() {
                expect(wireTapData.length).to.be(1);
                expect(wireTapEnvelope.length).to.be(1);
            });
            it("wireTap data should match expected results", function() {
                expect(wireTapData[0]).to.be("I'm in yer bus, tappin' yer subscriptionz...");
            });
            it("wireTap envelope should match expected results", function() {
                expect(wireTapEnvelope[0].channel).to.be(postal.configuration.DEFAULT_CHANNEL);
                expect(wireTapEnvelope[0].topic).to.be("Oh.Hai.There");
            });
        });
    });
}(this));