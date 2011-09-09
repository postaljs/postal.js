QUnit.specify("postal.js", function(){
    describe("broker", function(){
        describe("With Mode Change Messages", function(){
            describe("Change To Replay", function() {
                postal.reset();
                    var objA = {
                            messageCount: 0
                        },
                        mode;
                    var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function(d) {
                        console.log(d.fake);
                        objA.messageCount++;
                    });
                    postal.publish("MyExchangeA", "Test.Topic", { fake: 1});
                    postal.publish(SYSTEM_EXCHANGE, "mode.set", { mode: REPLAY_MODE });
                    mode = postal.getMode();
                    postal.publish("MyExchangeA", "Test.Topic", { fake: 2});
                    unsubscribeA();

                it("the subscription callback for objA should be invoked only once", function(){
                    assert(objA.messageCount).equals(1);
                });

                it("broker should report replay mode", function() {
                    assert(mode).equals(REPLAY_MODE);
                });
            });
            describe("Change To Replay & Back to Normal", function() {
                postal.reset();
                var mode,
                    objA = {
                        messageCount: 0
                    },
                    mode2;
                    var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function() { objA.messageCount++; });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    postal.publish(SYSTEM_EXCHANGE, "mode.set", { mode: REPLAY_MODE });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    mode = postal.getMode();
                    postal.publish(SYSTEM_EXCHANGE, "mode.set", { mode: NORMAL_MODE });
                    mode2 = postal.getMode();
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    unsubscribeA();

                it("the subscription callback for objA should be invoked only twice", function(){
                    assert(objA.messageCount).equals(2);
                });

                it("broker should report replay mode", function() {
                    assert(mode).equals(REPLAY_MODE);
                });

                it("broker should report normal mode", function() {
                    assert(mode2).equals(NORMAL_MODE);
                });
            });
        });
    });
});