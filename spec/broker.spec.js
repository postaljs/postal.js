QUnit.specify("postal.js", function(){
    describe("broker", function(){
        describe("When publishing a message to a specific one level topic", function() {
            describe("with one recipient", function() {
                var broker = new MessageBroker(),
                    objA = {
                        messageReceived: false
                    };

                broker.subscribe("Test", function() { objA.messageReceived = true; });
                broker.publish("Test", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                var broker = new MessageBroker(),
                    ObjA = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                broker.publish("TwoRecipients", {});

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
                var broker = new MessageBroker(),
                    objA = {
                        messageReceived: false
                    };

                broker.subscribe("Test.Topic", function() { objA.messageReceived = true; });
                broker.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                var broker = new MessageBroker(),
                    ObjA = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients.Listening", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients.Listening", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                broker.publish("TwoRecipients.Listening", {});

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
                var broker = new MessageBroker(),
                    objA = {
                        messageReceived: false
                    };

                broker.subscribe("Test.*", function() { objA.messageReceived = true; });
                broker.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageReceived).isTrue();
                });
            });
            describe("with two recipients", function() {
                var broker = new MessageBroker(),
                    ObjA = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients.Listening.*", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    },
                    ObjB = function() {
                        this.messageReceived = false;

                        broker.subscribe("TwoRecipients.*", function() {
                            this.messageReceived = true;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();

                broker.publish("TwoRecipients.Listening.Closely", {});

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
                var broker = new MessageBroker(),
                    objA = {
                        messageCount: 0
                    };

                var unsubscribe = broker.subscribe("Test.*", function() { objA.messageCount++; });
                broker.publish("Test.Topic", {});
                unsubscribe();
                broker.publish("Test.Topic", {});

                it("the subscription callback should be invoked", function(){
                    assert(objA.messageCount).equals(1);
                });
            });
            describe("with two callbacks", function() {
                var broker = new MessageBroker(),
                    ObjA = function() {
                        var _unsubscribe;
                        
                        this.messageCount = 0;

                        this.unsubscribe = function() {
                            if(_unsubscribe) {
                                _unsubscribe();
                            }
                        };

                        _unsubscribe = broker.subscribe("TwoRecipients.Listening.*", function() {
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

                        _unsubscribe = broker.subscribe("TwoRecipients.*", function() {
                            this.messageCount++;
                        }.bind(this));
                    };
                var a = new ObjA(),
                    b = new ObjB();
                broker.publish("TwoRecipients.Listening", {});
                a.unsubscribe();
                broker.publish("TwoRecipients.Listening", {});

                it("First object message count should be 1", function(){
                    assert(a.messageCount).equals(1);
                });

                it("Second object message count should be 2", function(){
                    assert(b.messageCount).equals(2);
                });
            });
        });
    });
});