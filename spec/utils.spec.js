/* global describe,it,after,before,beforeEach, afterEach */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("lodash") : window._;
    var NO_OP = function() {};
    var subscription;
    var sub;

    describe("postal.utils", function() {
        describe("When calling postal.getSubscribersFor", function() {
            var subs = [],
                i;
            before(function() {
                i = 10;
                var ch1 = postal.channel("MyChannel"),
                    ch2 = postal.channel("MyChannel2");
                while (i) {
                    subs.push(ch1.subscribe("MyTopic", NO_OP));
                    subs.push(ch2.subscribe("MyTopic2", NO_OP));
                    i--;
                }
            });
            after(function() {
                subs = [];
                postal.reset();
            });
            it("should return expected results for MyChannel/MyTopic", function() {
                var results = postal.getSubscribersFor({
                    channel: "MyChannel",
                    topic: "MyTopic"
                });
                expect(results.length).to.be(10);
            });
            it("should return expected results for MyChannel2/MyTopic2", function() {
                var results = postal.getSubscribersFor({
                    channel: "MyChannel2",
                    topic: "MyTopic2"
                });
                expect(results.length).to.be(10);
            });
        });
        describe("When calling postal.reset", function() {
            var resolver;
            before(function() {
                postal.reset();
                subscription = postal.channel("MyChannel").subscribe("MyTopic", function() {});
                postal.channel("MyChannel").publish("MyTopic", "Oh Hai!");
                sub = postal.subscriptions.MyChannel.MyTopic[0];
                resolver = postal.configuration.resolver.cache.MyTopic;
                postal.reset();
            });
            after(function() {});
            it("should have created a subscription definition", function() {
                expect(sub.channel).to.be("MyChannel");
                expect(sub.topic).to.be("MyTopic");
                expect(sub.context).to.be(undefined);
            });
            it("should have created a resolver cache entry", function() {
                expect(_.isEmpty(resolver)).to.not.be.ok();
                expect(resolver.MyTopic).to.be.ok();
            });
            it("subscriptions cache should now be empty", function() {
                expect(_.isEmpty(postal.subscriptions)).to.be.ok();
            });
            it("resolver cache should now be empty", function() {
                expect(_.isEmpty(postal.configuration.resolver.cache)).to.be.ok();
            });
        });
        describe("When calling postal.unsubscribeEach", function() {
            describe("With a channel passed", function() {
                var subs = [];
                var res = 0;
                var cb = function() {
                    res += 1;
                };
                beforeEach(function() {
                    subs.push(postal.subscribe({
                        channel: "A",
                        topic: "some.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "another.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "even.more.topics",
                        callback: cb
                    }));
                    postal.unsubscribeFor({
                        channel: "B"
                    });
                    postal.publish({
                        channel: "B",
                        topic: "another.topic",
                        data: {}
                    });
                    postal.publish({
                        channel: "B",
                        topic: "even.more.topics",
                        data: {}
                    });
                });
                afterEach(function() {
                    res = 0;
                    postal.reset();
                });
                it("should have removed correct subscribers", function() {
                    expect(_.reduce(postal.subscriptions.B, function(memo, val) {
                        return memo + val.length;
                    }, 0)).to.be(0);
                });
                it("should have not invoked subscriber callbacks when publishing", function() {
                    expect(res).to.be(0);
                });
            });
            describe("With a topic passed", function() {
                var subs = [];
                var res = 0;
                var cb = function() {
                    res += 1;
                };
                beforeEach(function() {
                    subs.push(postal.subscribe({
                        channel: "A",
                        topic: "some.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "another.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "even.more.topics",
                        callback: cb
                    }));
                    postal.unsubscribeFor({
                        channel: "B",
                        topic: "even.more.topics"
                    });
                    postal.publish({
                        channel: "B",
                        topic: "another.topic",
                        data: {}
                    });
                    postal.publish({
                        channel: "B",
                        topic: "even.more.topics",
                        data: {}
                    });
                });
                afterEach(function() {
                    res = 0;
                    subs = [];
                    postal.reset();
                });
                it("should have removed correct subscribers", function() {
                    expect(postal.subscriptions.B["even.more.topics"].length).to.be(0);
                });
                it("should have not invoked subscriber callbacks when publishing", function() {
                    expect(res).to.be(1);
                });
            });
            describe("With a context passed", function() {
                var subs = [];
                var res = 0;
                var cb = function() {
                    res += 1;
                };
                var obj = {
                    foo: "bar"
                };
                beforeEach(function() {
                    subs.push(postal.subscribe({
                        channel: "A",
                        topic: "some.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "another.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "even.more.topics",
                        callback: cb
                    }).withContext(obj));
                    postal.unsubscribeFor({
                        context: obj
                    });
                    postal.publish({
                        channel: "B",
                        topic: "another.topic",
                        data: {}
                    });
                    postal.publish({
                        channel: "B",
                        topic: "even.more.topics",
                        data: {}
                    });
                });
                afterEach(function() {
                    res = 0;
                    subs = [];
                    postal.reset();
                });
                it("should have removed correct subscribers", function() {
                    expect(postal.subscriptions.B["even.more.topics"].length).to.be(0);
                });
                it("should have not invoked subscriber callbacks when publishing", function() {
                    expect(res).to.be(1);
                });
            });
            describe("with a predicate passed", function() {
                var subs = [];
                var res = 0;
                var cb = function() {
                    res += 1;
                };
                beforeEach(function() {
                    subs.push(postal.subscribe({
                        channel: "A",
                        topic: "some.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "another.topic",
                        callback: cb
                    }));
                    subs.push(postal.subscribe({
                        channel: "B",
                        topic: "even.more.topics",
                        callback: cb
                    }));
                    subs[2].someProp = "hai";
                    postal.unsubscribeFor(function(sub) {
                        return sub.someProp === "hai";
                    });
                    postal.publish({
                        channel: "B",
                        topic: "another.topic",
                        data: {}
                    });
                    postal.publish({
                        channel: "B",
                        topic: "even.more.topics",
                        data: {}
                    });
                });
                afterEach(function() {
                    res = 0;
                    subs = [];
                    postal.reset();
                });
                it("should have removed correct subscribers", function() {
                    expect(postal.subscriptions.B["even.more.topics"].length).to.be(0);
                });
                it("should have not invoked subscriber callbacks when publishing", function() {
                    expect(res).to.be(1);
                });
            });
        });
    });
}());