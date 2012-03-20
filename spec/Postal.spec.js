QUnit.specify("postal.js", function(){
    describe("Postal", function(){
        var subscription,
            sub,
            channel,
            caughtSubscribeEvent = false,
            caughtUnsubscribeEvent = false;

        describe("when creating basic subscription", function() {
            var systemSubscription = {};
            before(function(){
                systemSubscription = postal.subscribe({
	                channel: "postal",
	                topic: "subscription.created",
	                callback: function(data, env){
	                    console.log("on subscription " + JSON.stringify(data));
	                    if( data.event &&
	                        data.event == "subscription.created" &&
	                        data.channel == "MyChannel" &&
	                        data.topic == "MyTopic") {
	                        caughtSubscribeEvent = true;
	                    }
	                }
                });
                subscription = postal.channel({ channel: "MyChannel", topic: "MyTopic" })
                                     .subscribe(function() { });
                sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
            });
            after(function(){
                systemSubscription.unsubscribe();
                postal.configuration.bus.subscriptions = {};
            });
            it("should create an channel called MyChannel", function(){
                assert(postal.configuration.bus.subscriptions["MyChannel"] !== undefined).isTrue();
            });
            it("should create a topic under MyChannel called MyTopic", function(){
                assert(postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined).isTrue();
            });
            it("should have set subscription channel value", function() {
                assert(sub.channel).equals("MyChannel");
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
            it("should have captured subscription creation event", function() {
                assert(caughtSubscribeEvent).isTrue();
            });
        });
        describe("when unsubscribing", function() {
            var subExistsBefore = false,
                subExistsAfter = true;
            var systemSubscription = {};
            before(function(){
                systemSubscription = postal.subscribe({
	                channel: "postal",
	                topic: "subscription.*",
	                callback: function(data, env){
	                    if( data.event &&
	                        data.event == "subscription.removed" &&
	                        data.channel == "MyChannel" &&
	                        data.topic == "MyTopic") {
	                        caughtUnsubscribeEvent = true;
	                    };
	                }
                });
                subscription = postal.channel({ channel: "MyChannel", topic: "MyTopic" })
                                     .subscribe(function() { });
                subExistsBefore = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0] !== undefined;
                subscription.unsubscribe();
                subExistsAfter = postal.configuration.bus.subscriptions.MyChannel.MyTopic.length !== 0;
            });
            after(function(){
                systemSubscription.unsubscribe();
                postal.configuration.bus.subscriptions = {};
            });
            it("subscription should exist before unsubscribe", function(){
                assert(subExistsBefore).isTrue();
            });
            it("subscription should not exist after unsubscribe", function(){
                assert(subExistsAfter).isFalse();
            });
            it("should have captured unsubscription creation event", function() {
                assert(caughtUnsubscribeEvent).isTrue();
            });
        });
	    describe("When publishing a message", function(){
            var msgReceivedCnt = 0,
                msgData;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                assert(postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length).equals(1);
            });
            it("subscription callback should be invoked once", function(){
                assert(subInvokedCnt).equals(1);
            });
        });
        describe("When subscribing and passing onHandled callback", function(){
            var whte = false;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
                subscription = channel.subscribe(function(data) {  })
                                      .whenHandledThenExecute(function() { whte = true; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                whte = false;
            });
            it("should have an onHandled callback on the subscription", function() {
                assert(typeof postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].onHandled).equals("function");
            });
            it("should have invoked the onHandled callback", function() {
                assert(whte).isTrue();
            });
        });
	    describe("When subscribing with one constraint returning true", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraint(function() { return true; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length).equals(1);
            });
            it("should have invoked the subscription callback", function() {
                assert(recvd).isTrue();
            });
        });
        describe("When subscribing with one constraint returning false", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
                subscription = channel.subscribe(function(data) { recvd= true; })
                                      .withConstraint(function() { return false; });
                channel.publish("Testing123");
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
                recvd = false;
            });
            it("should have a constraint on the subscription", function() {
                assert(postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length).equals(1);
            });
            it("should not have invoked the subscription callback", function() {
                assert(recvd).isFalse();
            });
        });
        describe("When subscribing with multiple constraints returning true", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                assert(postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length).equals(3);
            });
            it("should have invoked the onHandled callback", function() {
                assert(recvd).isTrue();
            });
        });
        describe("When subscribing with multiple constraints and one returning false", function(){
            var recvd = false;
            before(function(){
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                assert(postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length).equals(3);
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic" });
                channelB = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic" });
                channelC = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother" });
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic.#.SubTopic" });
                channelB = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic" });
                channelC = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic" });
                channelD = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother" });
                subscription = channel.subscribe(function(data) { count++; });
                channelC.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic", data: "Testing123"});
                channelB.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic", data: "Testing123"});
                channelD.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.*" });
                channelB = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic" });
                channelC = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic" });
                channelD = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother" });
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic.#.*" });
                channelB = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic" });
                channelC = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic" });
                channelD = postal.channel({ channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother" });
                channelE = postal.channel({ channel: "MyChannel", topic: "OtherTopic.MiddleTopic.SubTopic.YetAnother" });
                subscription = channel.subscribe(function(data) { count++; });

                channelC.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic", data: "Testing123"});
                channelB.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic", data: "Testing123"});
                channelD.publish({channel: "MyChannel", topic: "MyTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
                channelE.publish({channel: "MyChannel", topic: "OtherTopic.MiddleTopic.SubTopic.YetAnother", data: "Testing123"});
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
                channel = postal.channel({ channel: "MyChannel", topic: "MyTopic" });
                subscription = channel.subscribe(function(data) { msgReceivedCnt++; msgData = data;});
                postal.publish("MyChannel", "MyTopic", "Testing123");
                subscription.unsubscribe();
                postal.publish("MyChannel", "MyTopic", "Testing123");
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
                subscription = postal.subscribe({
	                channel: "MyChannel",
	                topic: "MyTopic",
	                callback: function() { }
                });
                sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
            });
            after(function(){
                postal.configuration.bus.subscriptions = {};
            });
            it("should create an channel called MyChannel", function(){
                assert(postal.configuration.bus.subscriptions["MyChannel"] !== undefined).isTrue();
            });
            it("should create a topic under MyChannel called MyTopic", function(){
                assert(postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined).isTrue();
            });
            it("should have set subscription channel value", function() {
                assert(sub.channel).equals("MyChannel");
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
	    describe("when subscribing and unsubscribing a wire tap", function() {
		    var wireTapData,
			    wireTapEnvelope,
			    wiretap;
		    before(function(){
			    caughtUnsubscribeEvent = false;
			    wireTapData = [];
			    wireTapEnvelope = [];
			    wiretap = postal.addWireTap(function(msg, envelope) {
				    wireTapData.push(msg);
				    wireTapEnvelope.push(envelope);
			    });
			    postal.publish({ data: "I'm in yer bus, tappin' yer subscriptionz..."}, { topic: "Oh.Hai.There" });
			    wiretap();
			    postal.publish({ data: "I'm in yer bus, tappin' yer subscriptionz..."}, { topic: "Oh.Hai.There" });
		    });
		    after(function(){
			    postal.configuration.bus.subscriptions = {};
		    });
		    it("wire tap should have been invoked only once", function(){
			    assert(wireTapData.length).equals(1);
			    assert(wireTapEnvelope.length).equals(1);
		    });
		    it("wireTap data should match expected results", function(){
			    assert(wireTapData[0].data).equals("I'm in yer bus, tappin' yer subscriptionz...");
		    });
		    it("wireTap envelope should match expected results", function() {
			    assert(wireTapEnvelope[0].channel).equals(DEFAULT_CHANNEL);
			    assert(wireTapEnvelope[0].topic).equals("Oh.Hai.There");
		    });
	    });
	    describe("when binding channel - one source to one destination", function(){
		    describe("with only channel values provided", function(){
			    var destData = [],
				    destEnv = [],
				    linkages;
			    before(function(){
				    linkages = postal.linkChannels({ channel: "sourceChannel" }, { channel: "destinationChannel" });
				    console.log(JSON.stringify(linkages));
				    subscription = postal.subscribe({ channel: "destinationChannel", topic: "Oh.Hai.There", callback: function(data, env) {
					    destData.push(data);
					    destEnv.push(env);
				    }});
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
				    linkages[0].unsubscribe();
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
			    });
			    after(function(){
				    postal.configuration.bus.subscriptions = {};
			    });
			    it("linked subscription should only have been invoked once", function(){
				    assert(destData.length).equals(1);
				    assert(destEnv.length).equals(1);
			    });
			    it("linked subscription data should match expected results", function(){
				    assert(destData[0].data).equals("I'm in yer bus, linkin' to yer subscriptionz...");
			    });
			    it("linked subscription envelope should match expected results", function() {
				    assert(destEnv[0].channel).equals("destinationChannel");
				    assert(destEnv[0].topic).equals("Oh.Hai.There");
			    });
		    });
		    describe("with channel and static topic values provided", function(){
			    var destData = [],
				    destEnv = [],
				    linkages;
			    before(function(){
				    linkages = postal.linkChannels({ channel: "sourceChannel", topic: "Oh.Hai.There"  }, { channel: "destinationChannel", topic: "kthxbye" });
				    subscription = postal.subscribe({ channel: "destinationChannel", topic: "kthxbye", callback: function(data, env) {
					    destData.push(data);
					    destEnv.push(env);
				    }});
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
				    linkages[0].unsubscribe();
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
			    });
			    after(function(){
				    postal.configuration.bus.subscriptions = {};
			    });
			    it("linked subscription should only have been invoked once", function(){
				    assert(destData.length).equals(1);
				    assert(destEnv.length).equals(1);
			    });
			    it("linked subscription data should match expected results", function(){
				    assert(destData[0].data).equals("I'm in yer bus, linkin' to yer subscriptionz...");
			    });
			    it("linked subscription envelope should match expected results", function() {
				    assert(destEnv[0].channel).equals("destinationChannel");
				    assert(destEnv[0].topic).equals("kthxbye");
			    });
		    });
		    describe("with channel and topic transform values provided", function(){
			    var destData = [],
				    destEnv = [],
				    linkages;
			    before(function(){
				    linkages = postal.linkChannels({ channel: "sourceChannel"  }, { channel: "destinationChannel", topic: function(tpc) { return "NewTopic." + tpc; } });
				    subscription = postal.subscribe({ channel: "destinationChannel", topic: "NewTopic.Oh.Hai.There", callback: function(data, env) {
					    destData.push(data);
					    destEnv.push(env);
				    }});
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
				    linkages[0].unsubscribe();
				    postal.publish("sourceChannel", "Oh.Hai.There", { data: "I'm in yer bus, linkin' to yer subscriptionz..."});
			    });
			    after(function(){
				    postal.configuration.bus.subscriptions = {};
			    });
			    it("linked subscription should only have been invoked once", function(){
				    assert(destData.length).equals(1);
				    assert(destEnv.length).equals(1);
			    });
			    it("linked subscription data should match expected results", function(){
				    assert(destData[0].data).equals("I'm in yer bus, linkin' to yer subscriptionz...");
			    });
			    it("linked subscription envelope should match expected results", function() {
				    assert(destEnv[0].channel).equals("destinationChannel");
				    assert(destEnv[0].topic).equals("NewTopic.Oh.Hai.There");
			    });
		    });
	    });
    });
});