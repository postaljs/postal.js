QUnit.specify("postal.js", function(){
    describe("Postal", function(){
        var subToken,
            sub;
        describe("when creating basic subscription", function() {
            before(function(){
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
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
                assert(sub.disposeAfter).equals(0);
            });
            it("should have defaulted the subscription context value", function() {
                assert(sub.context).isNull();
            });
        });
        describe("when unsubscribing", function() {
            var subExistsBefore = false,
                subExistsAfter = true;
            before(function(){
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
                            .subscribe(function() { });
                subExistsBefore = postal.configuration.bus.subscriptions.MyExchange.MyTopic[0] !== undefined;
                subToken();
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
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
                            .subscribe(function(data) { msgReceivedCnt++; msgData = data;});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                subToken();
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
                            .disposeAfter(5)
                            .subscribe(function(data) { msgReceivedCnt++; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
                            .ignoreDuplicates()
                            .subscribe(function(data) { subInvokedCnt++; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                            .topic("MyTopic")
                            .whenHandledThenExecute(function() { whte = true; })
                            .subscribe(function(data) {  });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                                 .topic("MyTopic")
                                 .withConstraint(function() { return true; })
                                 .subscribe(function(data) { recvd= true; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(1);
            });
            it("should have invoked the onHandled callback", function() {
                assert(recvd).isTrue();
            });
        });
        describe("When subscribing with one constraint returning false", function(){
            var recvd = false;
            before(function(){
                subToken = postal.exchange("MyExchange")
                                 .topic("MyTopic")
                                 .withConstraint(function() { return false; })
                                 .subscribe(function(data) { recvd= true; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyExchange.MyTopic[0].constraints.length).equals(1);
            });
            it("should not have invoked the onHandled callback", function() {
                assert(recvd).isFalse();
            });
        });
        describe("When subscribing with multiple constraints returning true", function(){
            var recvd = false;
            before(function(){
                subToken = postal.exchange("MyExchange")
                                 .topic("MyTopic")
                                 .withConstraints([function() { return true; },
                                                  function() { return true; },
                                                  function() { return true; }])
                                 .subscribe(function(data) { recvd= true; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                                 .topic("MyTopic")
                                 .withConstraints([function() { return true; },
                                                  function() { return false; },
                                                  function() { return true; }])
                                 .subscribe(function(data) { recvd= true; });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
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
                subToken = postal.exchange("MyExchange")
                                 .topic("MyTopic")
                                 .withContext(obj)
                                 .subscribe(function(data) { this.increment(); });
                postal.publish({exchange: "MyExchange", topic: "MyTopic", data: "Testing123"});
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("should have called obj.increment", function() {
                assert(count).equals(1);
            });
        });
    });
});