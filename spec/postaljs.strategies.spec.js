/* global describe, postal, it, after, before, expect */
/* jshint -W098, -W110 */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("lodash") : window._;
    var subscription;
    var channel;
    var caughtUnsubscribeEvent = false;

    describe("Subscription Creation - Pipeline Steps", function() {
        describe("When subscribing and ignoring duplicates", function() {
            var subInvokedCnt = 0;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    subInvokedCnt++;
                })
                    .distinctUntilChanged();
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
                subInvokedCnt = 0;
            });
            it("callback should be a strategy", function() {
                expect(typeof postal.subscriptions.MyChannel.MyTopic[0].callback.context).to.be("function");
            });
            it("subscription callback should be invoked once", function() {
                expect(subInvokedCnt).to.be(1);
            });
        });
        describe("When subscribing with a disposeAfter of 5", function() {
            var msgReceivedCnt = 0,
                subExistsAfter, systemSubscription;
            before(function() {
                caughtUnsubscribeEvent = false;
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    msgReceivedCnt++;
                }).disposeAfter(5);
                systemSubscription = postal.subscribe({
                    channel: "postal",
                    topic: "subscription.*",
                    callback: function(data) {
                        if (data.event &&
                            data.event === "subscription.removed" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic") {
                            caughtUnsubscribeEvent = true;
                        }
                    }
                });
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                subExistsAfter = postal.subscriptions.MyChannel.MyTopic.length !== 0;
            });
            after(function() {
                postal.reset();
            });
            it("subscription callback should be invoked 5 times", function() {
                expect(msgReceivedCnt).to.be(5);
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
        describe("With multiple subscribers on one channel", function() {
            var subscription1, subscription2, results = [];
            before(function() {
                channel = postal.channel();
                subscription1 = channel.subscribe("test", function() {
                    results.push("1 received message");
                }).once();

                subscription2 = channel.subscribe('test', function() {
                    results.push("2 received message");
                });
                channel.publish("test");
                channel.publish("test");

            });
            after(function() {
                subscription2.unsubscribe();
                postal.reset();
            });
            it("should produce expected messages", function() {
                expect(results.length).to.be(3);
                expect(results[0]).to.be("1 received message");
                expect(results[1]).to.be("2 received message");
                expect(results[2]).to.be("2 received message");
            });
        });
        describe("With nested publishing", function() {
            var subscription1, subscription2, sysub, results = [];
            before(function() {
                channel = postal.channel();
                sysub = postal.subscribe({
                    channel: postal.configuration.SYSTEM_CHANNEL,
                    topic: "subscription.removed",
                    callback: function(d, e) {
                        results.push("unsubscribed");
                    }
                });
                subscription1 = channel.subscribe("nest.test", function() {
                    results.push("1 received message");
                    channel.publish("nest.test2", "Hai");
                }).once();

                subscription2 = channel.subscribe("nest.test2", function() {
                    results.push("2 received message");
                });
                channel.publish("nest.test");
                channel.publish("nest.test");
            });
            after(function() {
                postal.reset();
            });
            it("should produce expected messages", function() {
                expect(results.length).to.be(3);
                expect(results[0]).to.be("1 received message");
                expect(results[1]).to.be("2 received message");
                expect(results[2]).to.be("unsubscribed");
            });
        });
        describe("When subscribing with debounce", function() {
            var results = [],
                debouncedChannel;
            before(function() {
                debouncedChannel = postal.channel("DebounceChannel");
                subscription = debouncedChannel.subscribe("MyTopic",
                    function(data) {
                        results.push(data);
                    }).withDebounce(800);
            });
            after(function() {
                postal.reset();
            });
            it("should have only invoked debounced callback once", function(done) {
                debouncedChannel.publish("MyTopic", 1); // starts the two second clock on debounce
                setTimeout(function() {
                    debouncedChannel.publish("MyTopic", 2);
                }, 20); // should not invoke callback
                setTimeout(function() {
                    debouncedChannel.publish("MyTopic", 3);
                }, 80); // should not invoke callback
                setTimeout(function() {
                    debouncedChannel.publish("MyTopic", 4);
                }, 250); // should not invoke callback
                setTimeout(function() {
                    debouncedChannel.publish("MyTopic", 5);
                }, 500); // should not invoke callback
                setTimeout(function() {
                    debouncedChannel.publish("MyTopic", 6);
                }, 1000); // should invoke callback
                setTimeout(function() {
                    expect(results[0]).to.be(6);
                    expect(results.length).to.be(1);
                    done();
                }, 1900);
            });
        });
        describe("When subscribing with defer", function() {
            var results = [];
            before(function() {
                channel = postal.channel("DeferChannel");

            });
            after(function() {
                postal.reset();
            });
            it("should have met expected results", function(done) {
                subscription = channel.subscribe("MyTopic",
                    function() {
                        results.push("second");
                        expect(results[0]).to.be("first");
                        expect(results[1]).to.be("second");
                        done();
                    }).defer();
                channel.publish("MyTopic", "Testing123");
                results.push("first");
            });
        });
        describe("When subscribing with delay", function() {
            var results = [];
            before(function() {
                channel = postal.channel("DelayChannel");
            });
            after(function() {
                postal.reset();
            });
            it("should have met expected results", function(done) {
                subscription = channel.subscribe("MyTopic",
                    function() {
                        results.push("second");
                        expect(results[0]).to.be("first");
                        expect(results[1]).to.be("second");
                        done();
                    }).withDelay(500);
                channel.publish("MyTopic", "Testing123");
                results.push("first");
            });
        });
        describe("When subscribing with once()", function() {
            var msgReceivedCnt = 0;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    msgReceivedCnt++;
                }).once();
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
            });
            it("subscription callback should be invoked 1 time", function() {
                expect(msgReceivedCnt).to.be(1);
            });
        });
        describe("When subscribing with multiple constraints returning true", function() {
            var recvd = false;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    recvd = true;
                })
                    .withConstraint(function() {
                        return true;
                    })
                    .withConstraint(function() {
                        return true;
                    })
                    .withConstraint(function() {
                        return true;
                    });
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
                recvd = false;
            });
            it("should show all 4 constraints added", function() {
                expect(subscription.callback.steps().length).to.be(4);
            });
            it("should have invoked the callback", function() {
                expect(recvd).to.be.ok();
            });
        });
        describe("When subscribing with one constraint returning false", function() {
            var recvd = false;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    recvd = true;
                })
                    .withConstraint(function() {
                        return false;
                    });
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                expect(subscription.callback.steps()[0].name).to.be("withConstraint");
            });
            it("should not have invoked the subscription callback", function() {
                expect(recvd).to.not.be.ok();
            });
        });
        describe("When subscribing with one constraint returning true", function() {
            var recvd = false;
            before(function() {
                channel = postal.channel("MyChannel");
                subscription = channel.subscribe("MyTopic", function() {
                    recvd = true;
                })
                    .withConstraint(function() {
                        return true;
                    });
                channel.publish("MyTopic", "Testing123");
            });
            after(function() {
                postal.reset();
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                expect(subscription.callback.steps()[0].name).to.be("withConstraint");
            });
            it("should have invoked the subscription callback", function() {
                expect(recvd).to.be.ok();
            });
        });
        describe("When subscribing with throttle", function() {
            var results = [],
                throttledChannel,
                throttlePub = function(x) {
                    throttledChannel.publish("MyTopic", x);
                };
            before(function() {
                throttledChannel = postal.channel("ThrottleChannel");
                subscription = throttledChannel.subscribe("MyTopic",
                    function(data) {
                        results.push(data);
                    }).withThrottle(500);
            });
            after(function() {
                postal.reset();
            });
            it("should have only invoked throttled callback twice", function(done) {
                throttledChannel.publish("MyTopic", 1);
                setTimeout(function() {
                    throttledChannel.publish("MyTopic", 800);
                }, 800); // should invoke callback
                for (var i = 0; i < 20; i++) {
                    throttlePub(i);
                }
                setTimeout(function() {
                    expect(results[0]).to.be(1);
                    expect(results[2]).to.be(800);
                    expect(results.length).to.be(3);
                    done();
                }, 1500);
            });
        });
    });

}(this));