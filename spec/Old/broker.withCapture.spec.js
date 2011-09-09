QUnit.specify("postal.js", function(){
    describe("broker", function(){
        describe("With Mode Change Messages", function(){
            describe("Change To Capture & Then to Normal", function() {
                postal.reset();
                var mode,
                    mode2,
                    objA = {
                        messageCount: 0
                    };
                    var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function() { objA.messageCount++; });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.CAPTURE_MODE });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    mode = postal.getMode();
                    postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.NORMAL_MODE });
                    mode2 = postal.getMode();
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    unsubscribeA();

                it("the subscription callback for objA should be invoked only 3x", function(){
                    assert(objA.messageCount).equals(3);
                });

                it("broker should report capture mode", function() {
                    assert(mode).equals(postal.CAPTURE_MODE);
                });

                it("broker should report normal mode", function() {
                    assert(mode2).equals(postal.NORMAL_MODE);
                });
            });
            describe("Change To Capture", function() {
                postal.reset();
                var mode,
                    store,
                    savedBatch,
                    objA = {
                        messageCount: 0
                    },
                    objB = {
                        messageCount: 0
                    };
                var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function() { objA.messageCount++; });
                var unsubscribeB = postal.subscribe("MyExchangeB", "Test.*", function() { objB.messageCount++; });
                postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.CAPTURE_MODE });
                mode = postal.getMode();
                postal.publish("MyExchangeA", "Test.Topic", {});
                postal.publish("MyExchangeA", "Test.Topic", {});
                postal.publish("MyExchangeB", "Test.Topic", {});
                postal.publish("MyExchangeB", "Test.Topic", {});
                unsubscribeA();
                unsubscribeB();
                postal.publish(postal.SYSTEM_EXCHANGE, "captor.save", { batchId: "MyMsgBatch", description: "Just a Test" });
                store = amplify.store(postal.POSTAL_MSG_STORE_KEY);
                for(var i in store) {
                    if(store.hasOwnProperty(i) && i.search(/withCapture.html/) !== -1) {
                        savedBatch = store[i]["MyMsgBatch"];
                    }
                }

                it("the subscription callback for objA should be invoked only twice", function(){
                    assert(objA.messageCount).equals(2);
                });

                it("broker should report replay mode", function() {
                    assert(mode).equals(postal.CAPTURE_MODE);
                });

                it("captured message batch should exist", function() {
                    assert(savedBatch !== undefined).isTrue();
                });

                it("captured message batch should have 4 messages", function() {

                });
            });
        });
    });
});