/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js")() : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("underscore") : window._;
    var subscription;
    var sub;
    var channel;
    var caughtSubscribeEvent = false;
    var caughtUnsubscribeEvent = false;

    describe("subscription creation", function(){
        describe( "When creating basic subscription", function () {
            var systemSubscription = {};
            before( function () {
                systemSubscription = postal.subscribe( {
                    channel  : "postal",
                    topic    : "subscription.created",
                    callback : function ( data, envelope ) {
                        if ( data.event &&
                            data.event === "subscription.created" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic" ) {
                            caughtSubscribeEvent = true;
                        }
                    }
                } );
                subscription = postal.channel( "MyChannel" ).subscribe( "MyTopic", function () {} );
                sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
            } );
            after( function () {
                systemSubscription.unsubscribe();
                postal.utils.reset();
            } );
            it( "should create a channel called MyChannel", function () {
                expect( postal.configuration.bus.subscriptions["MyChannel"] !== undefined ).to.be.ok();
            } );
            it( "should create a topic under MyChannel called MyTopic", function () {
                expect( postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined ).to.be.ok();
            } );
            it( "should have set subscription channel value", function () {
                expect( sub.channel ).to.be( "MyChannel" );
            } );
            it( "should have set subscription topic value", function () {
                expect( sub.topic ).to.be( "MyTopic" );
            } );
            it( "should have defaulted the subscription constraints array", function () {
                expect( sub.constraints.length ).to.be( 0 );
            } );
            it( "should have defaulted the subscription context value", function () {
                expect( sub.context ).to.be( null );
            } );
            it( "should have captured subscription creation event", function () {
                expect( caughtSubscribeEvent ).to.be.ok();
            } );
        } );
        describe( "When subscribing and ignoring duplicates", function () {
            var subInvokedCnt = 0;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    subInvokedCnt++;
                } )
                    .distinctUntilChanged();
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                subInvokedCnt = 0;
            } );
            it( "should have a constraint on the subscription", function () {
                expect( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).to.be( 1 );
            } );
            it( "subscription callback should be invoked once", function () {
                expect( subInvokedCnt ).to.be( 1 );
            } );
        } );
        describe( "When subscribing with a disposeAfter of 5", function () {
            var msgReceivedCnt = 0, subExistsAfter, systemSubscription;
            before( function () {
                caughtUnsubscribeEvent = false;
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function () {
                    msgReceivedCnt++;
                }).disposeAfter( 5 );
                systemSubscription = postal.subscribe( {
                    channel  : "postal",
                    topic    : "subscription.*",
                    callback : function ( data, env ) {
                        if ( data.event &&
                            data.event === "subscription.removed" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic" ) {
                            caughtUnsubscribeEvent = true;
                        }
                    }
                } );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                subExistsAfter = postal.configuration.bus.subscriptions.MyChannel.MyTopic.length !== 0;
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "subscription callback should be invoked 5 times", function () {
                expect( msgReceivedCnt ).to.be( 5 );
            } );
            it( "subscription should not exist after unsubscribe", function () {
                expect( subExistsAfter ).to.not.be.ok();
            } );
            it( "should have captured unsubscription creation event", function () {
                expect( caughtUnsubscribeEvent ).to.be.ok();
            } );
            it( "postal.getSubscribersFor('MyChannel', 'MyTopic') should not return any subscriptions", function () {
                expect( postal.utils.getSubscribersFor("MyChannel", "MyTopic").length ).to.be(0);
            } );
        } );
        describe( "When subscribing with a hierarchical binding, no wildcards", function () {
            var count = 0, channelB, channelC;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic.MiddleTopic", function ( data ) {
                    count++;
                } );
                channel.publish( "MyTopic.MiddleTopic.SubTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                count = 0;
            } );
            it( "should have invoked subscription callback only once", function () {
                expect( count ).to.be( 1 );
            } );
        } );
        describe( "When subscribing with a hierarchical binding, using #", function () {
            var count, channelB, channelC, channelD, channelE;
            before( function () {
                count = 0;
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic.#.SubTopic", function ( data, env ) {
                    count++;
                } );
                channel.publish( "MyTopic.MiddleTopic.SubTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubMiddle.SubTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                count = 0;
            } );
            it( "should have invoked subscription callback twice", function () {
                expect( count ).to.be( 2 );
            } );
        } );
        describe( "When subscribing with a hierarchical binding, using *", function () {
            var count = 0, channelB, channelC, channelD;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic.MiddleTopic.*", function ( data ) {
                    count++;
                } );

                channel.publish( "MyTopic.MiddleTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                count = 0;
            } );
            it( "should have invoked subscription callback twice", function () {
                expect( count ).to.be( 1 );
            } );
        } );
        describe( "When subscribing with a hierarchical binding, using # and *", function () {
            var count = 0, channelB, channelC, channelD, channelE;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic.#.*", function ( data ) {
                    count++;
                } );

                channel.publish( "MyTopic.MiddleTopic.SubTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic", "Testing123" );
                channel.publish( "MyTopic.MiddleTopic.SubTopic.YetAnother", "Testing123" );
                channel.publish( "OtherTopic.MiddleTopic.SubTopic.YetAnother", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                count = 0;
            } );
            it( "should have invoked subscription callback twice", function () {
                expect( count ).to.be( 3 );
            } );
        } );
        describe( "When subscribing with debounce", function () {
            var results = [], debouncedChannel;
            before( function () {
                debouncedChannel = postal.channel( "DebounceChannel" );
                subscription = debouncedChannel.subscribe( "MyTopic",
                    function ( data ) {
                        results.push( data );
                    } ).withDebounce( 800 );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "should have only invoked debounced callback once", function ( done ) {
                debouncedChannel.publish( "MyTopic", 1 ); // starts the two second clock on debounce
                setTimeout( function () {
                    debouncedChannel.publish( "MyTopic", 2 );
                }, 20 ); // should not invoke callback
                setTimeout( function () {
                    debouncedChannel.publish( "MyTopic", 3 );
                }, 80 ); // should not invoke callback
                setTimeout( function () {
                    debouncedChannel.publish( "MyTopic", 4 );
                }, 250 ); // should not invoke callback
                setTimeout( function () {
                    debouncedChannel.publish( "MyTopic", 5 );
                }, 500 ); // should not invoke callback
                setTimeout( function () {
                    debouncedChannel.publish( "MyTopic", 6 );
                }, 1000 ); // should invoke callback
                setTimeout( function () {
                    expect( results[0] ).to.be( 6 );
                    expect( results.length ).to.be( 1 );
                    done();
                }, 1900 );
            } );
        } );
        describe( "When subscribing with defer", function () {
            var results = [];
            before( function () {
                channel = postal.channel( "DeferChannel" );

            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "should have met expected results", function ( done ) {
                subscription = channel.subscribe( "MyTopic",
                    function ( data ) {
                        results.push( "second" );
                        expect( results[0] ).to.be( "first" );
                        expect( results[1] ).to.be( "second" );
                        done();
                    } ).defer();
                channel.publish( "MyTopic", "Testing123" );
                results.push( "first" );
            } );
        } );
        describe( "When subscribing with delay", function () {
            var results = [];
            before( function () {
                channel = postal.channel( "DelayChannel" );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "should have met expected results", function ( done ) {
                subscription = channel.subscribe( "MyTopic",
                    function ( data ) {
                        results.push( "second" );
                        expect( results[0] ).to.be( "first" );
                        expect( results[1] ).to.be( "second" );
                        done();
                    } ).withDelay( 500 );
                channel.publish( "MyTopic", "Testing123" );
                results.push( "first" );
            } );
        } );
        describe( "When subscribing with once()", function () {
            var msgReceivedCnt = 0;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic",function ( data ) {
                    msgReceivedCnt++;
                } ).once();
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "subscription callback should be invoked 1 time", function () {
                expect( msgReceivedCnt ).to.be( 1 );
            } );
        } );
        describe( "When subscribing with multiple constraints returning true", function () {
            var recvd = false;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
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
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                recvd = false;
            } );
            it( "should have a constraint on the subscription", function () {
                expect( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).to.be( 3 );
            } );
            it( "should have invoked the callback", function () {
                expect( recvd ).to.be.ok();
            } );
        } );
        describe( "When subscribing with multiple constraints and one returning false", function () {
            var recvd = false;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
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
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                recvd = false;
            } );
            it( "should have a constraint on the subscription", function () {
                expect( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).to.be( 3 );
            } );
            it( "should not have invoked the callback", function () {
                expect( recvd ).to.not.be.ok()
            } );
        } );
        describe( "When subscribing with one constraint returning false", function () {
            var recvd = false;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    recvd = true;
                } )
                    .withConstraint( function () {
                        return false;
                    } );
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                recvd = false;
            } );
            it( "should have a constraint on the subscription", function () {
                expect( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).to.be( 1 );
            } );
            it( "should not have invoked the subscription callback", function () {
                expect( recvd ).to.not.be.ok();
            } );
        } );
        describe( "When subscribing with one constraint returning true", function () {
            var recvd = false;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    recvd = true;
                } )
                    .withConstraint( function () {
                        return true;
                    } );
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
                recvd = false;
            } );
            it( "should have a constraint on the subscription", function () {
                expect( postal.configuration.bus.subscriptions.MyChannel.MyTopic[0].constraints.length ).to.be( 1 );
            } );
            it( "should have invoked the subscription callback", function () {
                expect( recvd ).to.be.ok();
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
                channel = postal.channel( "ContextChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    this.increment();
                } )
                    .withContext( obj );
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "should have called obj.increment", function () {
                expect( count ).to.be( 1 );
            } );
        } );
        describe( "When subscribing with throttle", function () {
            var results = [], throttledChannel;
            before( function () {
                throttledChannel = postal.channel( "ThrottleChannel" );
                subscription = throttledChannel.subscribe( "MyTopic",
                    function ( data ) {
                        results.push( data );
                    } ).withThrottle( 500 );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "should have only invoked throttled callback twice", function ( done ) {
                throttledChannel.publish( "MyTopic", 1 ); // starts the two second clock on debounce
                setTimeout( function () {
                    throttledChannel.publish( "MyTopic", 800 );
                }, 800 ); // should invoke callback
                for ( var i = 0; i < 20; i++ ) {
                    (function ( x ) {
                        throttledChannel.publish( "MyTopic", x );
                    })( i );
                }
                setTimeout( function () {
                    expect( results[0] ).to.be( 1 );
                    expect( results[2] ).to.be( 800 );
                    expect( results.length ).to.be( 3 );
                    done();
                }, 1500 );
            } );
        } );
        describe( "When using global subscribe api", function () {
            before( function () {
                subscription = postal.subscribe( {
                    channel  : "MyChannel",
                    topic    : "MyTopic",
                    callback : function () {
                    }
                } );
                sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "subscription should be of type SubscriptionDefinition", function () {
                expect( subscription instanceof postal.SubscriptionDefinition ).to.be.ok();
            } );
            it( "should create an channel called MyChannel", function () {
                expect( postal.configuration.bus.subscriptions["MyChannel"] !== undefined ).to.be.ok();
            } );
            it( "should create a topic under MyChannel called MyTopic", function () {
                expect( postal.configuration.bus.subscriptions["MyChannel"]["MyTopic"] !== undefined ).to.be.ok();
            } );
            it( "should have set subscription channel value", function () {
                expect( sub.channel ).to.be( "MyChannel" );
            } );
            it( "should have set subscription topic value", function () {
                expect( sub.topic ).to.be( "MyTopic" );
            } );
            it( "should have defaulted the subscription constraints array", function () {
                expect( sub.constraints.length ).to.be( 0 );
            } );
            it( "should have defaulted the subscription context value", function () {
                expect( sub.context ).to.be( null );
            } );
        } );
    });

    describe("publishing", function() {
        describe( "When publishing a message", function () {
            var msgReceivedCnt = 0,
                msgData;
            before( function () {
                channel = postal.channel( "MyChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    msgReceivedCnt++;
                    msgData = data;
                } );
                channel.publish( "MyTopic", "Testing123" );
                subscription.unsubscribe();
                channel.publish( "MyTopic", "Testing123" );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "subscription callback should be invoked once", function () {
                expect( msgReceivedCnt ).to.be( 1 );
            } );
            it( "subscription callback should receive published data", function () {
                expect( msgData ).to.be( "Testing123" );
            } );
        } );
        describe( "When publishing on a channel where no subscribers exist", function () {
            it( "should return expected results for MyChannel/MyTopic", function () {
                var env = postal.publish( {
                    channel : "NoOneIsUsingThisOne",
                    topic   : "This.Is.A.Lonely.Topic",
                    data    : "Y U NO SUBSCRIBE TO ME?"
                } );
                expect( !_.isEmpty( env ) ).to.be( true );
            } );
        } );
        describe( "When using global publish api", function () {
            var msgReceivedCnt = 0,
                msgData;
            before( function () {
                channel = postal.channel( "MyGlobalChannel" );
                subscription = channel.subscribe( "MyTopic", function ( data ) {
                    msgReceivedCnt++;
                    msgData = data;
                } );
                postal.publish( { channel : "MyGlobalChannel", topic : "MyTopic", data : "Testing123" } );
                subscription.unsubscribe();
                postal.publish( { channel : "MyGlobalChannel", topic : "MyTopic", data : "Testing123" } );
            } );
            after( function () {
                postal.utils.reset();
                msgReceivedCnt = 0;
            } );
            it( "channel should be of type ChannelDefinition", function () {
                expect( channel instanceof postal.ChannelDefinition ).to.be.ok();
            } );
            it( "subscription callback should be invoked once", function () {
                expect( msgReceivedCnt ).to.be( 1 );
            } );
            it( "subscription callback should receive published data", function () {
                expect( msgData ).to.be( "Testing123" );
            } );
        } );
    });

    describe("unsubscribing", function() {
        describe( "With a single subscription", function () {
            var subExistsBefore = false,
                subExistsAfter = true;
            var systemSubscription = {};
            before( function () {
                systemSubscription = postal.subscribe( {
                    channel  : "postal",
                    topic    : "subscription.*",
                    callback : function ( data, env ) {
                        if ( data.event &&
                            data.event === "subscription.removed" &&
                            data.channel === "MyChannel" &&
                            data.topic === "MyTopic" ) {
                            caughtUnsubscribeEvent = true;
                        }
                    }
                } );
                subscription = postal.channel( "MyChannel" ).subscribe( "MyTopic", function () { });
                subExistsBefore = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0] !== undefined;
                subscription.unsubscribe();
                subExistsAfter = postal.configuration.bus.subscriptions.MyChannel.MyTopic.length !== 0;
            } );
            after( function () {
                systemSubscription.unsubscribe();
                postal.utils.reset();
            } );
            it( "subscription should exist before unsubscribe", function () {
                expect( subExistsBefore ).to.be.ok();
            } );
            it( "subscription should not exist after unsubscribe", function () {
                expect( subExistsAfter ).to.not.be.ok();
            } );
            it( "should have captured unsubscription creation event", function () {
                expect( caughtUnsubscribeEvent ).to.be.ok();
            } );
            it( "postal.getSubscribersFor('MyChannel', 'MyTopic') should not return any subscriptions", function () {
                expect( postal.utils.getSubscribersFor("MyChannel", "MyTopic").length ).to.be(0);
            } );
        } );
        describe( "With multiple subscribers on one channel", function () {
            var subscription1, subscription2, results = [];
            before( function () {
                channel = postal.channel();
                subscription1 = channel.subscribe( 'test',function () {
                    results.push( '1 received message' );
                } ).once();

                subscription2 = channel.subscribe( 'test', function () {
                    results.push( '2 received message' );
                } );
                channel.publish( 'test' );
                channel.publish( 'test' );

            } );
            after( function () {
                subscription2.unsubscribe();
                postal.utils.reset();
            } );
            it( "should produce expected messages", function () {
                expect( results.length ).to.be( 3 );
                expect( results[0] ).to.be( "1 received message" );
                expect( results[1] ).to.be( "2 received message" );
                expect( results[2] ).to.be( "2 received message" );
            } );
        } );
        describe( "With nested publishing", function () {
            var subscription1, subscription2, sysub, results = [];
            before( function () {
                channel = postal.channel();
                sysub = postal.subscribe( {
                    channel  : postal.configuration.SYSTEM_CHANNEL,
                    topic    : "subscription.removed",
                    callback : function ( d, e ) {
                        results.push( "unsubscribed" );
                    }
                } );
                subscription1 = channel.subscribe( 'nest.test',function () {
                    results.push( '1 received message' );
                    channel.publish( "nest.test2", "Hai" );
                } ).once();

                subscription2 = channel.subscribe( 'nest.test2', function () {
                    results.push( '2 received message' );
                } );
                channel.publish( 'nest.test' );
                channel.publish( 'nest.test' );
            } );
            after( function () {
                //subscription2.unsubscribe();
                sysub.unsubscribe();
                postal.utils.reset();
            } );
            it( "should produce expected messages", function () {
                expect( results.length ).to.be( 3 );
                expect( results[0] ).to.be( "1 received message" );
                expect( results[1] ).to.be( "2 received message" );
                expect( results[2] ).to.be( "unsubscribed" );
            } );
        } );
    });

    describe("wiretaps", function() {
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
                expect( wireTapData.length ).to.be( 1 );
                expect( wireTapEnvelope.length ).to.be( 1 );
            } );
            it( "wireTap data should match expected results", function () {
                expect( wireTapData[0] ).to.be( "I'm in yer bus, tappin' yer subscriptionz..." );
            } );
            it( "wireTap envelope should match expected results", function () {
                expect( wireTapEnvelope[0].channel ).to.be( postal.configuration.DEFAULT_CHANNEL );
                expect( wireTapEnvelope[0].topic ).to.be( "Oh.Hai.There" );
            } );
        } );
    });
}());