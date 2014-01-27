/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var NO_OP = function () {};
    var SubscriptionDefinition = postal.SubscriptionDefinition;
    describe( "SubscriptionDefinition - Strategies", function () {

        describe( "When setting distinctUntilChanged", function () {
            var sDefa = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).distinctUntilChanged();

            it( "callback should be a strategy", function () {
                expect( typeof sDefa.callback.context ).to.be( "function" );
            });
        } );

        describe( "When adding a constraint", function () {
            var sDefb = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP ).withConstraint( function () {
            });

            it( "callback should be a strategy", function () {
                expect( typeof sDefb.callback.context ).to.be( "function" );
            });
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