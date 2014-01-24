/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js")() : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var NO_OP = function () {};
    var SubscriptionDefinition = postal.SubscriptionDefinition;
    describe( "SubscriptionDefinition", function () {
        describe( "When initializing SubscriptionDefinition", function () {
            var sDef,
                caughtSubscribeEvent,
                systemSubscription;
            before( function () {
                systemSubscription = postal.subscribe( {
                    channel  : "postal",
                    topic    : "subscription.created",
                    callback : function ( data, envelope ) {
                        if ( data.event &&
                            data.event === "subscription.created" &&
                            data.channel === "SubDefTestChannel" &&
                            data.topic === "SubDefTestTopic" ) {
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
            it( "should default the constraints", function () {
                expect( sDef.constraints.length ).to.be( 0 );
            } );
            it( "should default the context", function () {
                expect( sDef.context ).to.be( null );
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
            var obj = { name : "Rose" },
                name,
                sDefd = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP )
                    .withContext( obj )
                    .withConstraint( function ( d, e ) {
                        name = this.name;
                        return true;
                    } );

            postal.publish( { channel : "TestChannel", topic : "TestTopic", data : "Oh, hai"} );

            it( "Should set context", function () {
                expect( sDefd.context ).to.be( obj );
            } );
            it( "Should apply context to predicate/constraint", function () {
                expect( name ).to.be( "Rose" );
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

            it( "Should defer the callback", function ( done ) {
                sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data, env ) {
                    results.push( data );
                    expect( results[0] ).to.be( "first" );
                    expect( results[1] ).to.be( "second" );
                    expect( env.topic ).to.be( "TestTopic" );
                    done();
                } ).defer();

                sDefe.callback( "second", { topic : "TestTopic" } );
                results.push( "first" );
            } );

            it( "Should keep the context intact", function ( done ) {
                var context = {
                    key : 1234
                };
                sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data, env ) {
                    expect( this ).to.be( context );
                    done();
                } ).withContext(context).defer();
                sDefe.callback.call( sDefe.context, "stuff", { topic : "TestTopic" } );
            } );

            it( "Should keep the context intact when modified later", function ( done ) {
                var context = {
                    key : 1234
                };
                sDefe = new SubscriptionDefinition( "TestChannel", "TestTopic", function ( data, env ) {
                    expect( this ).to.be( context );
                    done();
                } ).defer().withContext(context);
                sDefe.callback.call( sDefe.context, "stuff", { topic : "TestTopic" } );
            } );
        } );

        describe( "When throttling the callback", function () {

            it( "should have only invoked throttled callback twice", function ( done ) {
                var results = [], timeout1, timeout2;
                var sDefe = new SubscriptionDefinition( "ThrottleTest", "TestTopic", function ( data ) {
                    results.push( data );
                } ).withThrottle( 1200, { leading: true } );
                sDefe.callback( 1 ); // starts the clock on throttle
                timeout1 = setTimeout( function () {
                    sDefe.callback( 700 );
                }, 700 ); // should invoke callback
                for ( var i = 0; i < 20; i++ ) {
                    (function ( x ) {
                        sDefe.callback( x );
                    })( i );
                }
                timeout2 = setTimeout( function () {
                    expect( results[0] ).to.be( 1 );
                    expect( results.length ).to.be( 2 );
                    done();
                }, 1500 );
            } );

            it( "Should keep the context intact", function( done ) {
                var results = [], timeout1, timeout2;
                var sDefe = new SubscriptionDefinition( "ThrottleTest", "TestTopic", function ( data ) {
                    results.push( data );
                } ).withThrottle( 1000, { leading: true } );
                var context = {
                    key : 'abcd'
                };
                sDefe = new SubscriptionDefinition( "ThrottleTest", "TestTopic", function( data, env ) {
                    expect( this ).to.be( context );
                    done();
                } ).withContext( context ).withThrottle( 500 );

                sDefe.callback.call( sDefe.context, 1 );
            } );
        } );

        describe( "When delaying the callback", function () {
            var results = [], sDefe;

            it( "Should delay the callback", function ( done ) {
                sDefe = new SubscriptionDefinition( "DelayTest", "TestTopic", function ( data, env ) {
                    results.push( data );
                    expect( results[0] ).to.be( "first" );
                    expect( results[1] ).to.be( "second" );
                    expect( env.topic ).to.be( "TestTopic" );
                    done();
                } ).withDelay( 200 );
                sDefe.callback( "second", { topic : "TestTopic" } );
                results.push( "first" );
            } );

            it( "Should keep the context intact", function ( done ) {
                var context = {
                    key : 1234
                };
                sDefe = new SubscriptionDefinition( "DelayTest", "TestTopic", function ( data, env ) {
                    expect( this ).to.be( context );
                    done();
                } ).withContext(context).withDelay( 200 );
                sDefe.callback.call( sDefe.context, "stuff", { topic : "TestTopic" } );
            } );
        } );

        describe( "When debouncing the callback", function () {
            var results = [],
                sDefe = new SubscriptionDefinition( "DebounceTest", "TestTopic", function ( data ) {
                    results.push( data );
                } ).withDebounce( 800 );

            it( "should have only invoked debounced callback once", function ( done ) {
                sDefe.callback( 1 ); // starts the two second clock on debounce
                setTimeout( function () {
                    sDefe.callback( 2 );
                }, 20 ); // should not invoke callback
                setTimeout( function () {
                    sDefe.callback( 3 );
                }, 80 ); // should not invoke callback
                setTimeout( function () {
                    sDefe.callback( 6 );
                }, 800 ); // should invoke callback
                setTimeout( function () {
                    expect( results[0] ).to.be( 6 );
                    expect( results.length ).to.be( 1 );
                    done();
                }, 1800 );
            } );

            it( "Should keep the context intact", function ( done ) {
                var context = {
                    key : 5678
                };
                var timeout;
                sDefe = new SubscriptionDefinition( "DebounceTest", "TestTopic", function ( data, env ) {
                    expect( this ).to.be( context );
                    clearTimeout(timeout);
                    done();
                } ).withContext(context).withDebounce( 100 );

                sDefe.callback.call( sDefe.context, 1 );
                timeout = setTimeout( function () {
                    sDefe.callback.call( sDefe.context, 2 );
                }, 200 ); // should invoke callback
            });
        } );

        describe( "When self disposing", function () {
            var context = {
                key : 'abcd'
            };

            it( "Should be inactive", function () {
                var sDefe = new SubscriptionDefinition( "DisposeTest", "TestTopic", function ( data, env ) {
                } ).withContext(context).disposeAfter( 1 );

                sDefe.callback.call( sDefe.context, "stuff", { topic : "TestTopic" } );

                expect( sDefe.inactive ).to.be( true );
            } );

            it( "Should keep the context intact", function ( done ) {
                var sDefe = new SubscriptionDefinition( "DisposeTest", "TestTopic", function ( data, env ) {
                    expect( this ).to.be( context );
                    done();
                } ).withContext(context).disposeAfter( 200 );
                sDefe.callback.call( sDefe.context, "stuff", { topic : "TestTopic" } );
            } );
        } );
    } );
}());