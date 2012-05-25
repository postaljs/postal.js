QUnit.reorder = false;
QUnit.specify( "postal.js", function () {
	describe( "Postal", function () {
		var subscription,
			sub,
			channel,
			caughtSubscribeEvent = false,
			caughtUnsubscribeEvent = false;

		describe( "When creating basic subscription", function () {
			var systemSubscription = {};
			before( function () {
				systemSubscription = postal.subscribe( {
					channel : "postal",
					topic : "subscription.created",
					callback : function ( data, envelope ) {
						if ( data.event &&
						     data.event == "subscription.created" &&
						     data.channel == "MyChannel" &&
						     data.topic == "MyTopic" ) {
							caughtSubscribeEvent = true;
						}
					}
				} );
				subscription = postal.channel( { channel : "MyChannel", topic : "MyTopic" } )
					.subscribe( function () {
					} );
				sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
			} );
			after( function () {
				systemSubscription.unsubscribe();
				postal.utils.reset();
			} );
			it( "should create a channel called MyChannel", function () {
				assert( postal.configuration.bus.subscriptions["MyChannel"] !== undefined ).isTrue();
			} );
			it( "should create a topic under MyChannel called MyTopic", function () {
				assert( postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined ).isTrue();
			} );
			it( "should have set subscription channel value", function () {
				assert( sub.channel ).equals( "MyChannel" );
			} );
			it( "should have set subscription topic value", function () {
				assert( sub.topic ).equals( "MyTopic" );
			} );
			it( "should have set subscription priority value", function () {
				assert( sub.priority ).equals( 50 );
			} );
			it( "should have defaulted the subscription constraints array", function () {
				assert( sub.constraints.length ).equals( 0 );
			} );
			it( "should have defaulted the subscription disposeAfter value", function () {
				assert( sub.maxCalls ).equals( 0 );
			} );
			it( "should have defaulted the subscription context value", function () {
				assert( sub.context ).isNull();
			} );
			it( "should have captured subscription creation event", function () {
				assert( caughtSubscribeEvent ).isTrue();
			} );
		} );
		describe( "When unsubscribing", function () {
			var subExistsBefore = false,
				subExistsAfter = true;
			var systemSubscription = {};
			before( function () {
				systemSubscription = postal.subscribe( {
					channel : "postal",
					topic : "subscription.*",
					callback : function ( data, env ) {
						if ( data.event &&
						     data.event == "subscription.removed" &&
						     data.channel == "MyChannel" &&
						     data.topic == "MyTopic" ) {
							caughtUnsubscribeEvent = true;
						}
						;
					}
				} );
				subscription = postal.channel( { channel : "MyChannel", topic : "MyTopic" } )
					.subscribe( function () {
					} );
				subExistsBefore = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0] !== undefined;
				subscription.unsubscribe();
				subExistsAfter = postal.configuration.bus.subscriptions.MyChannel.MyTopic.length !== 0;
			} );
			after( function () {
				systemSubscription.unsubscribe();
				postal.utils.reset();
			} );
			it( "subscription should exist before unsubscribe", function () {
				assert( subExistsBefore ).isTrue();
			} );
			it( "subscription should not exist after unsubscribe", function () {
				assert( subExistsAfter ).isFalse();
			} );
			it( "should have captured unsubscription creation event", function () {
				assert( caughtUnsubscribeEvent ).isTrue();
			} );
		} );
		describe( "When publishing a message", function () {
			var msgReceivedCnt = 0,
				msgData;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					msgReceivedCnt++;
					msgData = data;
				} );
				channel.publish( "Testing123" );
				subscription.unsubscribe();
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "subscription callback should be invoked once", function () {
				assert( msgReceivedCnt ).equals( 1 );
			} );
			it( "subscription callback should receive published data", function () {
				assert( msgData ).equals( "Testing123" );
			} );
		} );
		describe( "When subscribing multiple subscribers with different priority", function () {
			var s1, s2, r1 = [];
			before( function () {
				s1 = postal.subscribe( { channel : "MyChannel", topic : "MyTopic", callback: function() { r1.push("lower"); } } ).withPriority(200);
				s2 = postal.subscribe( { channel : "MyChannel", topic : "MyTopic", callback: function() { r1.push("higher"); } } ).withPriority(1);
				postal.publish( { channel: "MyChannel", topic: "MyTopic", data: "Oh, Hai!" } );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should invoke higher priority subscription first", function () {
				assert(r1[0] ).isEqualTo("higher");
				assert(r1[1] ).isEqualTo("lower");
			} );
		} );
		describe( "When subscribing with a disposeAfter of 5", function () {
			var msgReceivedCnt = 0;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					msgReceivedCnt++;
				} )
					.disposeAfter( 5 );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "subscription callback should be invoked 5 times", function () {
				assert( msgReceivedCnt ).equals( 5 );
			} );
		} );
		describe( "When subscribing and ignoring duplicates", function () {
			var subInvokedCnt = 0;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					subInvokedCnt++;
				} )
					.distinctUntilChanged();
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				subInvokedCnt = 0;
			} );
			it( "should have a constraint on the subscription", function () {
				assert( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).equals( 1 );
			} );
			it( "subscription callback should be invoked once", function () {
				assert( subInvokedCnt ).equals( 1 );
			} );
		} );
		describe( "When subscribing with one constraint returning true", function () {
			var recvd = false;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					recvd = true;
				} )
					.withConstraint( function () {
						return true;
					} );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				recvd = false;
			} );
			it( "should have a constraint on the subscription", function () {
				assert( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).equals( 1 );
			} );
			it( "should have invoked the subscription callback", function () {
				assert( recvd ).isTrue();
			} );
		} );
		describe( "When subscribing with one constraint returning false", function () {
			var recvd = false;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					recvd = true;
				} )
					.withConstraint( function () {
						return false;
					} );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				recvd = false;
			} );
			it( "should have a constraint on the subscription", function () {
				assert( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).equals( 1 );
			} );
			it( "should not have invoked the subscription callback", function () {
				assert( recvd ).isFalse();
			} );
		} );
		describe( "When subscribing with multiple constraints returning true", function () {
			var recvd = false;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					recvd = true;
				} )
					.withConstraints( [function () {
					return true;
				},
				                       function () {
					                       return true;
				                       },
				                       function () {
					                       return true;
				                       }] );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				recvd = false;
			} );
			it( "should have a constraint on the subscription", function () {
				assert( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).equals( 3 );
			} );
			it( "should have invoked the callback", function () {
				assert( recvd ).isTrue();
			} );
		} );
		describe( "When subscribing with multiple constraints and one returning false", function () {
			var recvd = false;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					recvd = true;
				} )
					.withConstraints( [function () {
					return true;
				},
				                       function () {
					                       return false;
				                       },
				                       function () {
					                       return true;
				                       }] );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				recvd = false;
			} );
			it( "should have a constraint on the subscription", function () {
				assert( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).equals( 3 );
			} );
			it( "should not have invoked the callback", function () {
				assert( recvd ).isFalse();
			} );
		} );
		describe( "When subscribing with the context being set", function () {
			var count = 0,
				obj = {
					increment : function () {
						count++;
					}
				};
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					this.increment();
				} )
					.withContext( obj );
				channel.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should have called obj.increment", function () {
				assert( count ).equals( 1 );
			} );
		} );
		describe( "When subscribing with defer", function () {
			var results = [];
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe(
					function ( data ) {
						results.push( "second" );
					} ).defer();
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should have met expected results", function () {
				channel.publish( "Testing123" );
				results.push( "first" );
				wait( 1, function () {
					assert( results[0] ).equals( "first" );
					assert( results[1] ).equals( "second" );
				} );
			} );
		} );
		describe( "When subscribing with delay", function () {
			var results = [];
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic" } );
				subscription = channel.subscribe(
					function ( data ) {
						results.push( "second" );
					} ).withDelay( 500 );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should have met expected results", function () {
				channel.publish( "Testing123" );
				results.push( "first" );
				wait( 1000, function () {
					assert( results[0] ).equals( "first" );
					assert( results[1] ).equals( "second" );
				} );
			} );
		} );
		describe( "When subscribing with debounce", function () {
			var results = [], debouncedChannel;
			before( function () {
				debouncedChannel = postal.channel( { channel : "DebouncedChannel", topic : "MyTopic" } );
				subscription = debouncedChannel.subscribe(
					function ( data ) {
						results.push( data );
					} ).withDebounce( 800 );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should have only invoked debounced callback once", async( function () {
				debouncedChannel.publish( 1 ); // starts the two second clock on debounce
				setTimeout( function () {
					debouncedChannel.publish( 2 );
				}, 20 ); // should not invoke callback
				setTimeout( function () {
					debouncedChannel.publish( 3 );
				}, 80 ); // should not invoke callback
				setTimeout( function () {
					debouncedChannel.publish( 4 );
				}, 250 ); // should not invoke callback
				setTimeout( function () {
					debouncedChannel.publish( 5 );
				}, 500 ); // should not invoke callback
				setTimeout( function () {
					debouncedChannel.publish( 6 );
				}, 1000 ); // should invoke callback
				setTimeout( function () {
					assert( results[0] ).equals( 6 );
					assert( results.length ).equals( 1 );
					resume();
				}, 2400 );
			} ) );
		} );
		describe( "When subscribing with throttle", function () {
			var results = [], throttledChannel;
			before( function () {
				throttledChannel = postal.channel( { channel : "ThrottledChannel", topic : "MyTopic" } );
				subscription = throttledChannel.subscribe(
					function ( data ) {
						results.push( data );
					} ).withThrottle( 500 );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "should have only invoked throttled callback twice", async( function () {
				throttledChannel.publish( 1 ); // starts the two second clock on debounce
				setTimeout( function () {
					throttledChannel.publish( 800 );
				}, 800 ); // should invoke callback
				for ( var i = 0; i < 20; i++ ) {
					(function ( x ) {
						throttledChannel.publish( x );
					})( i );
				}
				setTimeout( function () {
					assert( results[0] ).equals( 1 );
					assert( results[1] ).equals( 800 );
					assert( results.length ).equals( 2 );
					resume();
				}, 1500 );
			} ) );
		} );
		describe( "When subscribing with a hierarchical binding, no wildcards", function () {
			var count = 0, channelB, channelC;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic" } );
				channelB = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic" } );
				channelC = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother" } );
				subscription = channel.subscribe( function ( data ) {
					count++;
				} );
				channel.publish( "Testing123" );
				channelB.publish( "Testing123" );
				channelC.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				count = 0;
			} );
			it( "should have invoked subscription callback only once", function () {
				assert( count ).equals( 1 );
			} );
		} );
		describe( "When subscribing with a hierarchical binding, using #", function () {
			var count = 0, channelB, channelC, channelD;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic.#.SubTopic" } );
				channelB = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic" } );
				channelC = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic" } );
				channelD = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother" } );
				subscription = channel.subscribe( function ( data ) {
					count++;
				} );
				channelC.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic", data : "Testing123"} );
				channelB.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic", data : "Testing123"} );
				channelD.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother", data : "Testing123"} );
			} );
			after( function () {
				postal.utils.reset();
				count = 0;
			} );
			it( "should have invoked subscription callback only once", function () {
				assert( count ).equals( 1 );
			} );
		} );
		describe( "When subscribing with a hierarchical binding, using *", function () {
			var count = 0, channelB, channelC, channelD;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.*" } );
				channelB = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic" } );
				channelC = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic" } );
				channelD = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother" } );
				subscription = channel.subscribe( function ( data ) {
					count++;
				} );

				channelC.publish( "Testing123" );
				channelB.publish( "Testing123" );
				channelD.publish( "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				count = 0;
			} );
			it( "should have invoked subscription callback twice", function () {
				assert( count ).equals( 2 );
			} );
		} );
		describe( "When subscribing with a hierarchical binding, using # and *", function () {
			var count = 0, channelB, channelC, channelD, channelE;
			before( function () {
				channel = postal.channel( { channel : "MyChannel", topic : "MyTopic.#.*" } );
				channelB = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic" } );
				channelC = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic" } );
				channelD = postal.channel( { channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother" } );
				channelE = postal.channel( { channel : "MyChannel", topic : "OtherTopic.MiddleTopic.SubTopic.YetAnother" } );
				subscription = channel.subscribe( function ( data ) {
					count++;
				} );

				channelC.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic", data : "Testing123"} );
				channelB.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic", data : "Testing123"} );
				channelD.publish( {channel : "MyChannel", topic : "MyTopic.MiddleTopic.SubTopic.YetAnother", data : "Testing123"} );
				channelE.publish( {channel : "MyChannel", topic : "OtherTopic.MiddleTopic.SubTopic.YetAnother", data : "Testing123"} );
			} );
			after( function () {
				postal.utils.reset();
				count = 0;
			} );
			it( "should have invoked subscription callback twice", function () {
				assert( count ).equals( 2 );
			} );
		} );
		describe( "When using global publish api", function () {
			var msgReceivedCnt = 0,
				msgData;
			before( function () {
				channel = postal.channel( { channel : "MyGlobalChannel", topic : "MyTopic" } );
				subscription = channel.subscribe( function ( data ) {
					msgReceivedCnt++;
					msgData = data;
				} );
				postal.publish( "MyGlobalChannel", "MyTopic", "Testing123" );
				subscription.unsubscribe();
				postal.publish( "MyGlobalChannel", "MyTopic", "Testing123" );
			} );
			after( function () {
				postal.utils.reset();
				msgReceivedCnt = 0;
			} );
			it( "channel should be of type ChannelDefinition", function () {
				assert( channel instanceof ChannelDefinition ).isTrue();
			} );
			it( "subscription callback should be invoked once", function () {
				assert( msgReceivedCnt ).equals( 1 );
			} );
			it( "subscription callback should receive published data", function () {
				assert( msgData ).equals( "Testing123" );
			} );
		} );
		describe( "When using global subscribe api", function () {
			before( function () {
				subscription = postal.subscribe( {
					channel : "MyChannel",
					topic : "MyTopic",
					callback : function () {
					}
				} );
				sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "subscription should be of type SubscriptionDefinition", function () {
				assert( subscription instanceof SubscriptionDefinition ).isTrue();
			} );
			it( "should create an channel called MyChannel", function () {
				assert( postal.configuration.bus.subscriptions["MyChannel"] !== undefined ).isTrue();
			} );
			it( "should create a topic under MyChannel called MyTopic", function () {
				assert( postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined ).isTrue();
			} );
			it( "should have set subscription channel value", function () {
				assert( sub.channel ).equals( "MyChannel" );
			} );
			it( "should have set subscription topic value", function () {
				assert( sub.topic ).equals( "MyTopic" );
			} );
			it( "should have set subscription priority value", function () {
				assert( sub.priority ).equals( 50 );
			} );
			it( "should have defaulted the subscription constraints array", function () {
				assert( sub.constraints.length ).equals( 0 );
			} );
			it( "should have defaulted the subscription disposeAfter value", function () {
				assert( sub.maxCalls ).equals( 0 );
			} );
			it( "should have defaulted the subscription context value", function () {
				assert( sub.context ).isNull();
			} );
		} );
		describe( "When using global channel api", function () {
			var gch;
			describe( "With no channel name provided", function () {
				describe( "Using string argument", function () {
					before( function () {
						gch = postal.channel( "SomeTopic" );
					} );
					after( function () {
						gch = undefined;
					} );
					it( "channel should be of type ChannelDefinition", function () {
						assert( gch instanceof ChannelDefinition ).isTrue();
					} );
					it( "should set channel name to DEFAULT_CHANNEL", function () {
						assert( gch.channel ).equals( DEFAULT_CHANNEL );
					} );
					it( "should set topic to SomeTopic", function () {
						assert( gch._topic ).equals( "SomeTopic" );
					} );
				} );
				describe( "Using options (object) argument", function () {
					before( function () {
						gch = postal.channel( { topic : "SomeTopic" } );
					} );
					after( function () {
						gch = undefined;
					} );
					it( "channel should be of type ChannelDefinition", function () {
						assert( gch instanceof ChannelDefinition ).isTrue();
					} );
					it( "should set channel name to DEFAULT_CHANNEL", function () {
						assert( gch.channel ).equals( DEFAULT_CHANNEL );
					} );
					it( "should set topic to SomeTopic", function () {
						assert( gch._topic ).equals( "SomeTopic" );
					} );
				} );
			} );
			describe( "With channel name provided", function () {
				describe( "Using string arguments", function () {
					before( function () {
						gch = postal.channel( "SomeChannel", "SomeTopic" );
					} );
					after( function () {
						gch = undefined;
					} );
					it( "channel should be of type ChannelDefinition", function () {
						assert( gch instanceof ChannelDefinition ).isTrue();
					} );
					it( "should set channel name to SomeChannel", function () {
						assert( gch.channel ).equals( "SomeChannel" );
					} );
					it( "should set topic to SomeTopic", function () {
						assert( gch._topic ).equals( "SomeTopic" );
					} );
				} );
				describe( "Using options (object) argument", function () {
					before( function () {
						gch = postal.channel( { channel : "SomeChannel", topic : "SomeTopic" } );
					} );
					after( function () {
						gch = undefined;
					} );
					it( "channel should be of type ChannelDefinition", function () {
						assert( gch instanceof ChannelDefinition ).isTrue();
					} );
					it( "should set channel name to SomeChannel", function () {
						assert( gch.channel ).equals( "SomeChannel" );
					} );
					it( "should set topic to SomeTopic", function () {
						assert( gch._topic ).equals( "SomeTopic" );
					} );
				} );
			} );
		} );
		describe( "When subscribing and unsubscribing a wire tap", function () {
			var wireTapData,
				wireTapEnvelope,
				wiretap;
			before( function () {
				caughtUnsubscribeEvent = false;
				wireTapData = [];
				wireTapEnvelope = [];
				wiretap = postal.addWireTap( function ( msg, envelope ) {
					wireTapData.push( msg );
					wireTapEnvelope.push( envelope );
				} );
				postal.publish( { topic : "Oh.Hai.There", data : "I'm in yer bus, tappin' yer subscriptionz..."} );
				wiretap();
				postal.publish( { topic : "Oh.Hai.There", data : "I'm in yer bus, tappin' yer subscriptionz..."} );
			} );
			after( function () {
				postal.utils.reset();
			} );
			it( "wire tap should have been invoked only once", function () {
				assert( wireTapData.length ).equals( 1 );
				assert( wireTapEnvelope.length ).equals( 1 );
			} );
			it( "wireTap data should match expected results", function () {
				assert( wireTapData[0] ).equals( "I'm in yer bus, tappin' yer subscriptionz..." );
			} );
			it( "wireTap envelope should match expected results", function () {
				assert( wireTapEnvelope[0].channel ).equals( DEFAULT_CHANNEL );
				assert( wireTapEnvelope[0].topic ).equals( "Oh.Hai.There" );
			} );
		} );
		describe( "When binding channel - one source to one destination", function () {
			describe( "with only channel values provided", function () {
				var destData = [],
					destEnv = [],
					linkages;
				before( function () {
					linkages = postal.linkChannels( { channel : "sourceChannel" }, { channel : "destinationChannel" } );
					subscription = postal.subscribe( { channel : "destinationChannel", topic : "Oh.Hai.There", callback : function ( data, env ) {
						destData.push( data );
						destEnv.push( env );
					}} );
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
					linkages[0].unsubscribe();
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
				} );
				after( function () {
					postal.utils.reset();
				} );
				it( "linked subscription should only have been invoked once", function () {
					assert( destData.length ).equals( 1 );
					assert( destEnv.length ).equals( 1 );
				} );
				it( "linked subscription data should match expected results", function () {
					assert( destData[0].data ).equals( "I'm in yer bus, linkin' to yer subscriptionz..." );
				} );
				it( "linked subscription envelope should match expected results", function () {
					assert( destEnv[0].channel ).equals( "destinationChannel" );
					assert( destEnv[0].topic ).equals( "Oh.Hai.There" );
				} );
			} );
			describe( "with channel and static topic values provided", function () {
				var destData = [],
					destEnv = [],
					linkages;
				before( function () {
					linkages = postal.linkChannels( { channel : "sourceChannel", topic : "Oh.Hai.There"  }, { channel : "destinationChannel", topic : "kthxbye" } );
					subscription = postal.subscribe( { channel : "destinationChannel", topic : "kthxbye", callback : function ( data, env ) {
						destData.push( data );
						destEnv.push( env );
					}} );
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
					linkages[0].unsubscribe();
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
				} );
				after( function () {
					postal.utils.reset();
				} );
				it( "linked subscription should only have been invoked once", function () {
					assert( destData.length ).equals( 1 );
					assert( destEnv.length ).equals( 1 );
				} );
				it( "linked subscription data should match expected results", function () {
					assert( destData[0].data ).equals( "I'm in yer bus, linkin' to yer subscriptionz..." );
				} );
				it( "linked subscription envelope should match expected results", function () {
					assert( destEnv[0].channel ).equals( "destinationChannel" );
					assert( destEnv[0].topic ).equals( "kthxbye" );
				} );
			} );
			describe( "with channel and topic transform values provided", function () {
				var destData = [],
					destEnv = [],
					linkages;
				before( function () {
					linkages = postal.linkChannels( { channel : "sourceChannel"  }, { channel : "destinationChannel", topic : function ( tpc ) {
						return "NewTopic." + tpc;
					} } );
					subscription = postal.subscribe( { channel : "destinationChannel", topic : "NewTopic.Oh.Hai.There", callback : function ( data, env ) {
						destData.push( data );
						destEnv.push( env );
					}} );
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
					linkages[0].unsubscribe();
					postal.publish( "sourceChannel", "Oh.Hai.There", { data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
				} );
				after( function () {
					postal.utils.reset();
				} );
				it( "linked subscription should only have been invoked once", function () {
					assert( destData.length ).equals( 1 );
					assert( destEnv.length ).equals( 1 );
				} );
				it( "linked subscription data should match expected results", function () {
					assert( destData[0].data ).equals( "I'm in yer bus, linkin' to yer subscriptionz..." );
				} );
				it( "linked subscription envelope should match expected results", function () {
					assert( destEnv[0].channel ).equals( "destinationChannel" );
					assert( destEnv[0].topic ).equals( "NewTopic.Oh.Hai.There" );
				} );
			} );
		} );
		describe( "When calling postal.utils.reset", function () {
			var resolver;
			before( function () {
				postal.utils.reset();
				subscription = postal.channel( { channel : "MyChannel", topic : "MyTopic" } ).subscribe( function () {
				} );
				postal.channel( { channel : "MyChannel", topic : "MyTopic" } ).publish( "Oh Hai!" );
				sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
				resolver = postal.configuration.resolver.cache["MyTopic"];
				postal.utils.reset();
			} );
			after( function () {
			} );
			it( "should have created a subscription definition", function () {
				assert( sub.channel ).equals( "MyChannel" );
				assert( sub.topic ).equals( "MyTopic" );
				assert( sub.priority ).equals( 50 );
				assert( sub.constraints.length ).equals( 0 );
				assert( sub.maxCalls ).equals( 0 );
				assert( sub.context ).isNull();
			} );
			it( "should have created a resolver cache entry", function () {
				assert( _.isEmpty( resolver ) ).isFalse();
				assert( resolver["MyTopic"] ).isTrue();
			} );
			it( "subscriptions cache should now be empty", function () {
				assert( _.isEmpty( postal.configuration.bus.subscriptions ) ).isTrue();
			} );
			it( "resolver cache should now be empty", function () {
				assert( _.isEmpty( postal.configuration.resolver.cache ) ).isTrue();
			} );
		} );
		describe( "When calling utils.getSubscribersFor", function () {
			var subs = [], i;
			before( function () {
				i = 10;
				var ch1 = postal.channel( { channel : "MyChannel", topic : "MyTopic" } ),
					ch2 = postal.channel( { channel : "MyChannel2", topic : "MyTopic2" } );
				while ( i ) {
					subs.push( ch1.subscribe( function () {
					} ) );
					subs.push( ch2.subscribe( function () {
					} ) );
					i--;
				}
			} );
			after( function () {
				sub = [];
				postal.utils.reset();
			} );
			it( "should return expected results for MyChannel/MyTopic", function () {
				var results = postal.utils.getSubscribersFor( { channel : "MyChannel", topic : "MyTopic" } );
				assert( results.length ).equals( 10 );
			} );
			it( "should return expected results for MyChannel2/MyTopic2", function () {
				var results = postal.utils.getSubscribersFor( { channel : "MyChannel2", topic : "MyTopic2" } );
				assert( results.length ).equals( 10 );
			} );
		} );
	} );
} );