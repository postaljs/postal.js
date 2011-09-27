QUnit.specify("postal.js", function(){
    describe("Postal", function(){
        var subscription,
            sub,
            channel;
        describe("when creating basic subscription", function() {
            before(function(){
                subscription = postal.channel("MyExchange","MyTopic")
                                     .subscribe(function() { });
                sub = postal.configuration.bus.subscriptions.MyExchange.MyTopic[0];
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("should create an exchange called MyExchange", function(){
                assert(postal.configuration.bus.subscriptions["MyExchange"] !== undefined).isTrue();
            });
            it("should create a topic under MyExchange called MyTopic", function(){
                assert(postal.configuration.bus.subscriptions["MyExchange"]["MyTopic"] !== undefined).isTrue();
            });
            it("should have set subscription exchange value", function() {
                assert(sub.exchange).equals("MyExchange");
            });
            it("should have set subscription topic value", function() {
                assert(sub.topic).equals("MyTopic");
            });
            it("should have set subscription priority value", function() {
                assert(sub.priority).equals(50);
            });
            it("should have defaulted the subscription constraints array", function() {
                assert(sub.constraints.length).equals(0);
            });
            it("should have defaulted the subscription disposeAfter value", function() {
                assert(sub.maxCalls).equals(0);
            });
            it("should have defaulted the subscription context value", function() {
                assert(sub.context).isNull();
            });
        });
        describe("when unsubscribing", function() {
            var subExistsBefore = false,
                subExistsAfter = true;
            before(function(){
                subscription = postal.channel("MyExchange","MyTopic")
                                     .subscribe(function() { });
                subExistsBefore = postal.configuration.bus.subscriptions.MyExchange.MyTopic[0] !== undefined;
                subscription.unsubscribe();
                subExistsAfter = postal.configuration.bus.subscriptions.MyExchange.MyTopic.length !== 0;
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("subscription should exist before unsubscribe", function(){
                assert(subExistsBefore).isTrue();
            });
            it("subscription should not exist after unsubscribe", function(){
                assert(subExistsAfter).isFalse();
            });
        });
        describe("When publishing a message", function(){
            var msgReceivedCnt = 0,
                msgData;
            before(function(){
                channel = postal.channel("MyExchange","MyTopic")
                subscription = channel.subscribe(function(data) { msgReceivedCnt++; msgData = data;});
                channel.publish("Testing123");
                subscription.unsubscribe();
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("subscription callback should be invoked once", function(){
                assert(msgReceivedCnt).equals(1);
            });
            it("subscription callback should receive published data", function(){
                assert(msgData).equals("Testing123");
            });
        });
        describe("When subscribing with a disposeAfter of 5", function(){
            var msgReceivedCnt = 0;
            before(function(){
                channel = postal.channel("MyExchange","MyTopic");
                subscription = channel.subscribe(function(data) { msgReceivedCnt++; })
                                      .disposeAfter(5);
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("subscription callback should be invoked 5 times", function(){
                assert(msgReceivedCnt).equals(5);
            });
        });
        describe("When subscribing and ignoring duplicates", function(){
            var subInvokedCnt = 0;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { subInvokedCnt++; })
                                      .ignoreDuplicates();
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                subInvokedCnt = 0;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(1);
            });
            it("subscription callback should be invoked once", function(){
                assert(subInvokedCnt).equals(1);
            });
        });
        describe("When subscribing and passing onHandled callback", function(){
            var whte = false;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) {  })
                                      .whenHandledThenExecute(function() { whte = true; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                whte = false;
            });
            it("should have an onHandled callback on the subscription", function() {
                assert(typeof postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].onHandled).equals("function");
            });
            it("should have invoked the onHandled callback", function() {
                assert(whte).isTrue();
            });
        });
        describe("When subscribing with one constraint returning true", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraint(function() { return true; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(1);
            });
            it("should have invoked the subscription callback", function() {
                assert(recvd).isTrue();
            });
        });
        describe("When subscribing with one constraint returning false", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraint(function() { return false; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(1);
            });
            it("should not have invoked the subscription callback", function() {
                assert(recvd).isFalse();
            });
        });
        describe("When subscribing with multiple constraints returning true", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraints([function() { return true; },
                                                       function() { return true; },
                                                       function() { return true; }]);
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(3);
            });
            it("should have invoked the onHandled callback", function() {
                assert(recvd).isTrue();
            });
        });
        describe("When subscribing with multiple constraints and one returning false", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraints([function() { return true; },
                                                       function() { return false; },
                                                       function() { return true; }]);
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(3);
            });
            it("should not have invoked the onHandled callback", function() {
                assert(recvd).isFalse();
            });
        });
        describe("When subscribing with the context being set", function(){
            var count = 0,
                obj = {
                    increment: function() {
                        count++;
                    }
                };
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic");
                subscription = channel.subscribe(function(data) { this.increment(); })
                                      .withContext(obj);
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("should have called obj.increment", function() {
                assert(count).equals(1);
            });
        });
        describe("When subscribing with a hierarchical binding, no wildcards", function(){
            var count = 0, channelB, channelC;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic");
                channelB = postal.channel("MyExchange", "MyTopic.MiddleTopic");
                channelC = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic.YetAnother");
                subscription = channel.subscribe(function(data) { count++; });
                channel.publish("Testing123");
                channelB.publish("Testing123");
                channelC.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                count = 0;
            });
            it("should have invoked subscription callback only once", function() {
                assert(count).equals(1);
            });
        });
        describe("When subscribing with a hierarchical binding, using #", function(){
            var count = 0, channelB, channelC, channelD;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic.#.SubTopic");
                channelB = postal.channel("MyExchange", "MyTopic.MiddleTopic");
                channelC = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic");
                channelD = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic.YetAnother");
                subscription = channel.subscribe(function(data) { count++; });
                channelC.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic.SubTopic", data: "Testing123"});
                channelB.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic", data: "Testing123"});
                channelD.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                count = 0;
            });
            it("should have invoked subscription callback only once", function() {
                assert(count).equals(1);
            });
        });
        describe("When subscribing with a hierarchical binding, using *", function(){
            var count = 0, channelB, channelC, channelD;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic.MiddleTopic.*");
                channelB = postal.channel("MyExchange", "MyTopic.MiddleTopic");
                channelC = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic");
                channelD = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic.YetAnother");
                subscription = channel.subscribe(function(data) { count++; });

                channelC.publish("Testing123");
                channelB.publish("Testing123");
                channelD.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                count = 0;
            });
            it("should have invoked subscription callback twice", function() {
                assert(count).equals(2);
            });
        });
        describe("When subscribing with a hierarchical binding, using # and *", function(){
            var count = 0, channelB, channelC, channelD, channelE;
            before(function(){
                channel = postal.channel("MyExchange", "MyTopic.#.*");
                channelB = postal.channel("MyExchange", "MyTopic.MiddleTopic");
                channelC = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic");
                channelD = postal.channel("MyExchange", "MyTopic.MiddleTopic.SubTopic.YetAnother");
                channelE = postal.channel("MyExchange", "OtherTopic.MiddleTopic.SubTopic.YetAnother");
                subscription = channel.subscribe(function(data) { count++; });

                channelC.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic.SubTopic", data: "Testing123"});
                channelB.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic", data: "Testing123"});
                channelD.publish({exchange: "MyExchange", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
                channelE.publish({exchange: "MyExchange", topic: "OtherTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                count = 0;
            });
            it("should have invoked subscription callback twice", function() {
                assert(count).equals(2);
            });
        });
        describe("When using shortcut publish api", function(){
            var msgReceivedCnt = 0,
                msgData;
            before(function(){
                channel = postal.channel("MyExchange","MyTopic")
                subscription = channel.subscribe(function(data) { msgReceivedCnt++; msgData = data;});
                postal.publish("MyExchange", "MyTopic", "Testing123");
                subscription.unsubscribe();
                postal.publish("MyExchange", "MyTopic", "Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("subscription callback should be invoked once", function(){
                assert(msgReceivedCnt).equals(1);
            });
            it("subscription callback should receive published data", function(){
                assert(msgData).equals("Testing123");
            });
        });
        describe("When using shortcut subscribe api", function(){
            before(function(){
                subscription = postal.subscribe("MyExchange", "MyTopic", function() { });
                sub = postal.configuration.bus.subscriptions.MyExchange.MyTopic[0];
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("should create an exchange called MyExchange", function(){
                assert(postal.configuration.bus.subscriptions["MyExchange"] !== undefined).isTrue();
            });
            it("should create a topic under MyExchange called MyTopic", function(){
                assert(postal.configuration.bus.subscriptions["MyExchange"]["MyTopic"] !== undefined).isTrue();
            });
            it("should have set subscription exchange value", function() {
                assert(sub.exchange).equals("MyExchange");
            });
            it("should have set subscription topic value", function() {
                assert(sub.topic).equals("MyTopic");
            });
            it("should have set subscription priority value", function() {
                assert(sub.priority).equals(50);
            });
            it("should have defaulted the subscription constraints array", function() {
                assert(sub.constraints.length).equals(0);
            });
            it("should have defaulted the subscription disposeAfter value", function() {
                assert(sub.maxCalls).equals(0);
            });
            it("should have defaulted the subscription context value", function() {
                assert(sub.context).isNull();
            });
        });
        // TODO: Add test coverage for direct unsubscribe and wire taps
    });
});