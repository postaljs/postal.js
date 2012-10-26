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
			expect( sDef.channel ).to.be( "SubDefTestChannel" );
		} );
		it( "should set the topic to SubDefTestTopic", function () {
			expect( sDef.topic ).to.be( "SubDefTestTopic" );
		} );
		it( "should set the callback", function () {
			expect( sDef.callback ).to.be( NO_OP );
		} );
		it( "should default the priority", function () {
			expect( sDef.priority ).to.be( 50 );
		} );
		it( "should default the constraints", function () {
			expect( sDef.constraints.length ).to.be( 0 );
		} );
		it( "should default the maxCalls", function () {
			expect( sDef.maxCalls ).to.be( 0 );
		} );
		it( "should default the onHandled callback", function () {
			expect( sDef.onHandled ).to.be( NO_OP );
		} );
		it( "should default the context", function () {
			expect( sDef.context ).to.be(null);
		} );
		it( "should fire the subscription.created message", function () {
			expect( caughtSubscribeEvent ).to.be( true );
		} );
	} );

	describe( "When setting distinctUntilChanged", function () {
		var sDefa = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).distinctUntilChanged();

		it( "Should add a DistinctPredicate constraint to the configuration constraints", function () {
			expect( sDefa.constraints.length ).to.be( 1 );
		} );
	} );

	describe( "When adding a constraint", function () {
		var sDefb = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withConstraint( function () {
		} );

		it( "Should add a constraint", function () {
			expect( sDefb.constraints.length ).to.be( 1 );
		} );
	} );

	describe( "When adding multiple constraints", function () {
		var sDefc = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withConstraints( [function () {
		}, function () {
		}, function () {
		}] );

		it( "Should add a constraint", function () {
			expect( sDefc.constraints.length ).to.be( 3 );
		} );
	} );

	describe( "When setting the context", function () {
		var obj = {},
			sDefd = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withContext( obj );

		it( "Should set context", function () {
			expect( sDefd.context ).to.be( obj );
		} );
	} );

	describe( "When setting priority", function () {
		var sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withPriority( 10 );

		it( "Should set priority", function () {
			expect( sDefe.priority ).to.be( 10 );
		} );
	} );

	describe( "When calling subscribe to set the callback", function () {
		var sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ),
			fn = function () {
			};
		sDefe.subscribe( fn );

		it( "Should set the callback", function () {
			expect( sDefe.callback ).to.be( fn );
		} );
	} );

	describe( "When deferring the callback", function () {
		var results = [], sDefe;

		it( "Should defer the callback", function (done) {
			sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
				results.push( data );
				expect( results[0] ).to.be( "first" );
				expect( results[1] ).to.be( "second" );
				done();
			} ).defer();

			sDefe.callback( "second" );
			results.push( "first" );
		} );
	} );

	describe( "When delaying the callback", function () {
		var results = [], sDefe;

		it( "Should delay the callback", function (done) {
			sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
				results.push( data );
				expect( results[0] ).to.be( "first" );
				expect( results[1] ).to.be( "second" );
				done();
			} ).withDelay( 200 );
			sDefe.callback( "second" );
			results.push( "first" );
		} );
	} );

	describe( "When debouncing the callback", function () {
		var results = [],
			sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
				results.push( data );
			} ).withDebounce( 800 );

		it( "should have only invoked debounced callback once", function (done) {
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
				expect( results[0] ).to.be( 6 );
				expect( results.length ).to.be( 1 );
				done();
			}, 2400 );
		} );
	} );

	describe( "When throttling the callback", function () {
		var results = [],
			sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data ) {
				results.push( data );
			} ).withThrottle( 500 );

		it( "should have only invoked throttled callback twice", function (done) {
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
				expect( results[0] ).to.be( 1 );
				expect( results[1] ).to.be( 800 );
				expect( results.length ).to.be( 2 );
				done();
			}, 1500 );
		} );
	} );
} );