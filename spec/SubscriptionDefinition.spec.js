QUnit.specify( "postal.js", function () {
	describe( "SubscriptionDefinition", function () {
		describe( "When initializing SubscriptionDefinition", function () {
			var sDef,
				caughtSubscribeEvent,
				systemSubscription;
			before( function () {
				systemSubscription = postal.subscribe( {
					channel : "postal",
					topic : "subscription.created",
					callback : function ( data, envelope ) {
						if ( data.event &&
						     data.event == "subscription.created" &&
						     data.channel == "SubDefTestChannel" &&
						     data.topic == "SubDefTestTopic" ) {
							caughtSubscribeEvent = true;
						}
					}
				} );
				sDef = new SubscriptionDefinition( "SubDefTestChannel", "SubDefTestTopic", NO_OP );
			} );
			after( function () {
				sDef.unsubscribe();
				systemSubscription.unsubscribe();
				caughtSubscribeEvent = false;
			} );
			it( "should set the channel to SubDefTestChannel", function () {
				assert( sDef.channel ).equals( "SubDefTestChannel" );
			} );
			it( "should set the topic to SubDefTestTopic", function () {
				assert( sDef.topic ).equals( "SubDefTestTopic" );
			} );
			it( "should set the callback", function () {
				assert( sDef.callback ).equals( NO_OP );
			} );
			it( "should default the priority", function () {
				assert( sDef.priority ).equals( 50 );
			} );
			it( "should default the constraints", function () {
				assert( sDef.constraints.length ).equals( 0 );
			} );
			it( "should default the maxCalls", function () {
				assert( sDef.maxCalls ).equals( 0 );
			} );
			it( "should default the onHandled callback", function () {
				assert( sDef.onHandled ).equals( NO_OP );
			} );
			it( "should default the context", function () {
				assert( sDef.context ).isNull();
			} );
			it( "should fire the subscription.created message", function () {
				assert( caughtSubscribeEvent ).equals( true );
			} );
		} );

		describe( "When setting ignoreDuplicates", function () {
			var sDefa = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).ignoreDuplicates();

			it( "Should add a DistinctPredicate constraint to the configuration constraints", function () {
				assert( sDefa.constraints.length ).equals( 1 );
			} );
		} );

		describe( "When adding a constraint", function () {
			var sDefb = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withConstraint( function () {
			} );

			it( "Should add a constraint", function () {
				assert( sDefb.constraints.length ).equals( 1 );
			} );
		} );

		describe( "When adding multiple constraints", function () {
			var sDefc = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withConstraints( [function () {
			}, function () {
			}, function () {
			}] );

			it( "Should add a constraint", function () {
				assert( sDefc.constraints.length ).equals( 3 );
			} );
		} );

		describe( "When setting the context", function () {
			var obj = {},
				sDefd = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withContext( obj );

			it( "Should set context", function () {
				assert( sDefd.context ).equals( obj );
			} );
		} );

		describe( "When setting priority", function () {
			var sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withPriority( 10 );

			it( "Should set priority", function () {
				assert( sDefe.priority ).equals( 10 );
			} );
		} );

		describe( "When calling subscribe to set the callback", function () {
			var sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ),
				fn = function () {
				};
			sDefe.subscribe( fn );

			it( "Should set the callback", function () {
				assert( sDefe.callback ).equals( fn );
			} );
		} );

		describe( "When deferring the callback", function () {
			var results = [],
				sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
					results.push( data );
				} ).defer();
			sDefe.callback( "second" );
			results.push( "first" );

			it( "Should defer the callback", function () {
				wait( 1, function () {
					assert( results[0] ).equals( "first" );
					assert( results[1] ).equals( "second" );
				} );
			} );
		} );

		describe( "When delaying the callback", function () {
			var results = [],
				sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
					results.push( data );
				} ).withDelay( 200 );
			sDefe.callback( "second" );
			results.push( "first" );

			it( "Should delay the callback", function () {
				wait( 300, function () {
					assert( results[0] ).equals( "first" );
					assert( results[1] ).equals( "second" );
				} );
			} );
		} );

		describe( "When debouncing the callback", function () {
			var results = [],
				sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
					results.push( data );
				} ).withDebounce( 800 );

			it( "should have only invoked debounced callback once", async( function () {
				sDefe.callback( 1 ); // starts the two second clock on debounce
				setTimeout( function () {
					sDefe.callback( 2 );
				}, 20 ); // should not invoke callback
				setTimeout( function () {
					sDefe.callback( 3 );
				}, 80 ); // should not invoke callback
				setTimeout( function () {
					sDefe.callback( 4 );
				}, 250 ); // should not invoke callback
				setTimeout( function () {
					sDefe.callback( 5 );
				}, 500 ); // should not invoke callback
				setTimeout( function () {
					sDefe.callback( 6 );
				}, 1000 ); // should invoke callback
				setTimeout( function () {
					assert( results[0] ).equals( 6 );
					assert( results.length ).equals( 1 );
					resume();
				}, 2400 );
			} ) );
		} );

		describe( "When throttling the callback", function () {
			var results = [],
				sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
					results.push( data );
				} ).withThrottle( 500 );

			it( "should have only invoked throttled callback twice", async( function () {
				sDefe.callback( 1 ); // starts the two second clock on debounce
				setTimeout( function () {
					sDefe.callback( 800 );
				}, 800 ); // should invoke callback
				for ( var i = 0; i < 20; i++ ) {
					(function ( x ) {
						sDefe.callback( x );
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
	} );
} );
