QUnit.specify("postal.js", function(){
    describe("ChannelDefinition", function(){
        describe("When initializing a channel definition", function() {
            var chDef = new ChannelDefinition("TestExchange", "TestTopic");
            it("should set exchange to TestExchange", function(){
                assert(chDef.exchange).equals("TestExchange");
            });
            it("should set topic to TestTopic", function(){
                assert(chDef.topic).equals("TestTopic");
            });
        });
        describe("When calling subscribe", function() {
            var ch = new ChannelDefinition("TestExchange", "TestTopic"),
                sub = ch.subscribe(function(){ });
            it("subscription should be instance of SubscriptionDefinition", function(){
                assert(sub instanceof SubscriptionDefinition).isTrue();
            });
        });
    });
});