QUnit.specify("postal.js", function(){

    describe("ChannelDefinition", function(){
        describe("When initializing a basic channel definition", function() {
            var chDef = new ChannelDefinition();

            it("Should default the exchange", function() {
                assert(chDef.configuration.exchange).equals(DEFAULT_EXCHANGE);
            });
            it("Should default the topic", function() {
                assert(chDef.configuration.topic).equals("");
            });
            it("Should default the callback", function() {
                assert(chDef.configuration.callback).equals(NO_OP);
            });
            it("Should default the priority", function() {
                assert(chDef.configuration.priority).equals(DEFAULT_PRIORITY);
            });
            it("Should default the constraints", function() {
                assert(chDef.configuration.constraints.length).equals(0);
            });
            it("Should default the disposeAfter", function() {
                assert(chDef.configuration.disposeAfter).equals(DEFAULT_DISPOSEAFTER);
            });
            it("Should default the onHandled", function() {
                assert(chDef.configuration.onHandled).equals(NO_OP);
            });
            it("Should default the onHandled", function() {
                assert(chDef.configuration.context).isNull();
            });
        });

        describe("When setting the exchange through fluent configuration", function(){
            var chDefe = new ChannelDefinition();
            chDefe.exchange("TestExchange");

            it("Should set the exchange", function() {
                assert(chDefe.configuration.exchange).equals("TestExchange");
            });
        });

        describe("When setting the topic through fluent configuration", function(){
            var chDeft = new ChannelDefinition();
            chDeft.topic("TestTopic");

            it("Should set the topic", function() {
                assert(chDeft.configuration.topic).equals("TestTopic");
            });
        });

        describe("When setting the definition to defer", function(){
            var chDefd = new ChannelDefinition();
            chDefd.defer();
            it("Should set defer to true", function() {
                assert(_.any(chDefd.configuration.modifiers, function(item) { return item.type === "defer";})).isTrue();
            });
        });

        describe("When setting the definition to disposeAfter 2 invocations", function(){
            var chDefda = new ChannelDefinition();
            chDefda.disposeAfter(2);

            it("Should set disposeAfter to 2", function() {
                assert(chDefda.configuration.disposeAfter).equals(2);
            });
        });

        describe("When setting ignoreDuplicates", function(){
            var chDefid = new ChannelDefinition();
            chDefid.ignoreDuplicates();

            it("Should add a DistinctPredicate constraint to the configuration constraints", function() {
                assert(chDefid.configuration.constraints.length).equals(1);
            });
        });

        describe("When setting whenHandledThenExecute", function(){
            var chDefwhte = new ChannelDefinition();
            chDefwhte.whenHandledThenExecute(function() { });

            it("Should add an onHandled callback", function() {
                assert(typeof chDefwhte.configuration.onHandled).equals("function");
            });
        });

        describe("When adding a constraint", function(){
            var chDefc = new ChannelDefinition();
            chDefc.withConstraint(function() { });

            it("Should add a constraint", function() {
                assert(chDefc.configuration.constraints.length).equals(1);
            });
        });

        describe("When adding multiple constraints", function(){
            var chDefcs = new ChannelDefinition();
            chDefcs.withConstraints([function() { }, function() { }, function() { }]);

            it("Should add a constraint", function() {
                assert(chDefcs.configuration.constraints.length).equals(3);
            });
        });

        describe("When setting the context", function(){
            var chDefctx = new ChannelDefinition(),
                obj = {};
            chDefctx.withContext(obj);

            it("Should set context", function() {
                assert(chDefctx.configuration.context).equals(obj);
            });
        });

        describe("When setting debounce", function(){
            var chDefdb = new ChannelDefinition();
            chDefdb.withDebounce(1000);

            it("Should set debounce", function() {
                assert(_.any(chDefdb.configuration.modifiers, function(item) {
                    return item.type === "debounce" && item.milliseconds === 1000;
                })).isTrue();
            });
        });

        describe("When setting delay", function(){
            var chDefdl = new ChannelDefinition();
            chDefdl.withDelay(1000);

            it("Should set delay", function() {
                assert(_.any(chDefdl.configuration.modifiers, function(item) {
                    return item.type === "delay" && item.milliseconds === 1000;
                })).isTrue();
            });
        });

        describe("When setting priority", function(){
            var chDefp = new ChannelDefinition();
            chDefp.withPriority(10);

            it("Should set priority", function() {
                assert(chDefp.configuration.priority).equals(10);
            });
        });

        describe("When setting throttle", function(){
            var chDefth = new ChannelDefinition();
            chDefth.withThrottle(1000);

            it("Should set throttle", function() {
                assert(_.any(chDefth.configuration.modifiers, function(item) {
                    return item.type === "throttle" && item.milliseconds === 1000;
                })).isTrue();
            });
        });
    });
});