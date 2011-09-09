

QUnit.specify("postal.js", function(){
    describe("broker", function(){
        describe("When publishing a message to a specific one level topic", function() {
            describe("with one recipient", function() {
                postal.reset();
                var objA = {
                        messageReceived: false
                    };

                postal.subscribe("Test", function() { objA.messageReceived = true; });
                postal.publish("Test", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                postal.reset();
                var ObjA = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                postal.publish("TwoRecipients", {});

                it("the subscription callback should be invoked on 'a'", function(){
                    assert(a.messageReceived).isTrue();
                });

                it("the subscription callback should be invoked on 'b'", function(){
                    assert(b.messageReceived).isTrue();
                });
            });
        });
        describe("When publishing a message to a specific multi-level topic", function() {
            describe("with one recipient", function() {
                postal.reset();
                var objA = {
                        messageReceived: false
                    };

                postal.subscribe("Test.Topic", function() { objA.messageReceived = true; });
                postal.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                postal.reset();
                var ObjA = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients.Listening", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients.Listening", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                postal.publish("TwoRecipients.Listening", {});

                it("the subscription callback should be invoked on 'a'", function(){
                    assert(a.messageReceived).isTrue();
                });

                it("the subscription callback should be invoked on 'b'", function(){
                    assert(b.messageReceived).isTrue();
                });
            });
        });
        describe("When publishing a wildcard message to a multi-level topic", function() {
            describe("with one recipient", function() {
                postal.reset();
                var objA = {
                        messageReceived: false
                    };

                postal.subscribe("Test.*", function() { objA.messageReceived = true; });
                postal.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                postal.reset();
                var ObjA = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients.Listening.*", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        postal.subscribe("TwoRecipients.*", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                postal.publish("TwoRecipients.Listening.Closely", {});

                it("the subscription callback should be invoked on 'a'", function(){
                    assert(a.messageReceived).isTrue();
                });

                it("the subscription callback should be invoked on 'b'", function(){
                    assert(b.messageReceived).isTrue();
                });
            });
        });
        describe("When unsubscribing using provided callback", function() {
            describe("with one callback", function() {
                postal.reset();
                var objA = {
                        messageCount: 0
                    };

                var unsubscribe = postal.subscribe("Test.*", function() { objA.messageCount++; });
                postal.publish("Test.Topic", {});
                unsubscribe();
                postal.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageCount).equals(1);
                });
            });
            describe("with two callbacks", function() {
                postal.reset();
                var ObjA = function() {
                        var _unsubscribe;
                        
                        this.messageCount = 0;

                        this.unsubscribe = function() {
                            if(_unsubscribe) {
                                _unsubscribe();
                            }
                        };

                        _unsubscribe = postal.subscribe("TwoRecipients.Listening.*", function() {
                            this.messageCount++;
                        }.bind(this));
                    },
                    ObjB = function() {
                        var _unsubscribe;
                        
                        this.messageCount = 0;

                        this.unsubscribe = function() {
                            if(_unsubscribe) {
                                _unsubscribe();
                            }
                        };

                        _unsubscribe = postal.subscribe("TwoRecipients.*", function() {
                            this.messageCount++;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();
                postal.publish("TwoRecipients.Listening.Something", {});
                a.unsubscribe();
                postal.publish("TwoRecipients.Listening.Something", {});

                it("First object message count should be 1", function(){
                    assert(a.messageCount).equals(1);
                });

                it("Second object message count should be 2", function(){
                    assert(b.messageCount).equals(2);
                });
            });
        });
        describe("When publishing a message on a specific exchange", function(){
            describe("With a valid exchange", function() {
                postal.reset();
                var objA = {
                        messageCount: 0
                    };

                var unsubscribe = postal.subscribe("MyExchange", "Test.*", function() { objA.messageCount++; });
                postal.publish("MyExchange", "Test.Topic", {});
                unsubscribe();
                postal.publish("MyExchange", "Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageCount).equals(1);
                });
            });
            describe("With an invalid exchange", function() {
                postal.reset();
                var objA = {
                        messageCount: 0
                    };

                var unsubscribe = postal.subscribe("MyExchange", "Test.*", function() { objA.messageCount++; });
                postal.publish("WrongExchange", "Test.Topic", {});
                unsubscribe();
                postal.publish("WrongExchange", "Test.Topic", {});

                it("the subscription callback should not be invoked", function(){
                    assert(objA.messageCount).equals(0);
                });
            });
            describe("With multiple active exchanges", function() {
                describe("Publishing only to one exchange", function(){
                    postal.reset();
                    var objA = {
                        messageCount: 0
                    };
                    var objB = {
                        messageCount: 0
                    };

                    var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function() { objA.messageCount++; });
                    var unsubscribeB = postal.subscribe("MyExchangeB", "Test.*", function() { objB.messageCount++; });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    unsubscribeA();
                    unsubscribeB();

                    it("the subscription callback for objA should be invoked", function(){
                        assert(objA.messageCount).equals(2);
                    });

                    it("the subscription callback for objB should not be invoked", function(){
                        assert(objB.messageCount).equals(0);
                    });
                });
                describe("Publishing to multiple exchanges", function(){
                    postal.reset();
                    var objA = {
                        messageCount: 0
                    };
                    var objB = {
                        messageCount: 0
                    };

                    var unsubscribeA = postal.subscribe("MyExchangeA", "Test.*", function() { objA.messageCount++; });
                    var unsubscribeB = postal.subscribe("MyExchangeB", "Test.*", function() { objB.messageCount++; });
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    postal.publish("MyExchangeA", "Test.Topic", {});
                    postal.publish("MyExchangeB", "Test.Topic", {});
                    postal.publish("MyExchangeB", "Test.Topic", {});
                    postal.publish("MyExchangeB", "Test.Topic", {});
                    unsubscribeA();
                    unsubscribeB();

                    it("the subscription callback for objA should be invoked", function(){
                        assert(objA.messageCount).equals(2);
                    });

                    it("the subscription callback for objB should be invoked", function(){
                        assert(objB.messageCount).equals(3);
                    });
                });
            });
        });
    });
});