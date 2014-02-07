/* global describe, postal, it, after, before, expect */
(function () {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var SubscriptionDefinition = postal.SubscriptionDefinition;
    describe("ChannelDefinition - Strategies", function () {

        describe("When deferring the publish until 'next tick'", function () {
            var results = [], channel, subscription;
            before(function () {
                channel = postal.channel("DeferChannel");
                channel.publish.before(function (next, topic, data) {
                    setTimeout(function () {
                        next(topic, data);
                    }, 0);
                });
            });
            after(function () {
                postal.reset();
            });
            it("should have met expected results", function (done) {
                subscription = channel.subscribe("MyTopic",
                    function (data) {
                        results.push("second");
                        expect(results[0]).to.be("first");
                        expect(results[1]).to.be("second");
                        done();
                    }).defer();
                channel.publish("MyTopic", "Testing123");
                results.push("first");
            });
        });

        describe("When constraining publish with a predicate returning true", function() {
            var subFired = false, channel, subscription;
            before(function(){
                channel = postal.channel("ConstraintChannel");
                channel.publish.before(function (next, topic, data) {
                    if(true) {
                        next(topic, data);
                    }
                });
            });
            after(function () {
                postal.reset();
            });
            it("should have fired the subscription callback", function () {
                subscription = channel.subscribe("MyTopic",
                    function (data) {
                        subFired = true;
                    });
                channel.publish("MyTopic", "Testing123");
                expect(subFired).to.be(true);
            });
        });

        describe("When constraining publish with a predicate returning false", function() {
            var subFired = false, channel, subscription;
            before(function(){
                channel = postal.channel("ConstraintChannel");
                channel.publish.before(function (next, topic, data) {
                    if(false) {
                        next(topic, data);
                    }
                });
            });
            after(function () {
                postal.reset();
            });
            it("should NOT have fired the subscription callback", function () {
                subscription = channel.subscribe("MyTopic",
                    function (data) {
                        subFired = true;
                    });
                channel.publish("MyTopic", "Testing123");
                expect(subFired).to.be(false);
            });
        });

        describe("When using before-publish-steps to decorate envelope", function() {
           var channel, subscription, result;
            before(function() {
                channel = postal.channel("EnvDecoratorChannel");
                channel.publish.before(function (next, topic, data) {
                    next({ topic: topic, data: data, correlationId: "8675309" });
                });
            });
            after(function () {
                postal.reset();
            });
            it("should have added correlationId to envelope", function () {
                subscription = channel.subscribe("MyTopic",
                    function (data, env) {
                        result = env;
                    });
                channel.publish("MyTopic", "Testing123");
                expect(result.correlationId).to.be("8675309");
            });
        });
    });
}());