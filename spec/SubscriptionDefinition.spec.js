QUnit.specify("postal.js", function(){
    describe("SubscriptionDefinition", function(){
        describe("When initializing SubscriptionDefinition", function() {
            var sDef = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP);
            it("should set the exchange to TestExchange", function() {
                assert(sDef.exchange).equals("TestExchange");
            });
            it("should set the topic to TestTopic", function() {
                assert(sDef.topic).equals("TestTopic");
            });
            it("should set the callback", function() {
                assert(sDef.callback).equals(NO_OP);
            });
            it("should default the priority", function() {
                assert(sDef.priority).equals(50);
            });
            it("should default the constraints", function() {
                assert(sDef.constraints.length).equals(0);
            });
            it("should default the maxCalls", function() {
                assert(sDef.maxCalls).equals(0);
            });
            it("should default the onHandled", function() {
                assert(sDef.onHandled).equals(NO_OP);
            });
            it("should default the context", function() {
                assert(sDef.context).isNull();
            });
        });

        describe("When setting ignoreDuplicates", function(){
            var sDefa = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).ignoreDuplicates();

            it("Should add a DistinctPredicate constraint to the configuration constraints", function() {
                assert(sDefa.constraints.length).equals(1);
            });
        });

        describe("When adding a constraint", function(){
            var sDefb = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).withConstraint(function() { });

            it("Should add a constraint", function() {
                assert(sDefb.constraints.length).equals(1);
            });
        });

        describe("When adding multiple constraints", function(){
            var sDefc = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).withConstraints([function() { }, function() { }, function() { }]);

            it("Should add a constraint", function() {
                assert(sDefc.constraints.length).equals(3);
            });
        });

        describe("When setting the context", function(){
            var obj = {},
                sDefd = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).withContext(obj);

            it("Should set context", function() {
                assert(sDefd.context).equals(obj);
            });
        });

        describe("When setting priority", function(){
            var sDefe = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).withPriority(10);

            it("Should set priority", function() {
                assert(sDefe.priority).equals(10);
            });
        });

        describe("When setting whenHandledThenExecute", function(){
            var sDeff = new SubscriptionDefinition("TestExchange", "TestTopic", NO_OP).whenHandledThenExecute(function() { });

            it("Should add an onHandled callback", function() {
                assert(typeof sDeff.onHandled).equals("function");
            });
            it("Should not equal NO_OP", function() {
                assert(sDeff.onHandled).isNotEqualTo(NO_OP);
            });
        });

        //TODO:  need to determine best way to add tests for defer, debounce, throttle, delay & disposeAfter
    });
});
