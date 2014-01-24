/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js")() : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var subscription;
    describe("linked channels", function () {
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
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..." } );
                    linkages[0].unsubscribe();
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
                } );
                after( function () {
                    postal.utils.reset();
                } );
                it( "linked subscription should only have been invoked once", function () {
                    expect( destData.length ).to.be( 1 );
                    expect( destEnv.length ).to.be( 1 );
                } );
                it( "linked subscription data should match expected results", function () {
                    expect( destData[0] ).to.be( "I'm in yer bus, linkin' to yer subscriptionz..." );
                } );
                it( "linked subscription envelope should match expected results", function () {
                    expect( destEnv[0].channel ).to.be( "destinationChannel" );
                    expect( destEnv[0].topic ).to.be( "Oh.Hai.There" );
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
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
                    linkages[0].unsubscribe();
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
                } );
                after( function () {
                    postal.utils.reset();
                } );
                it( "linked subscription should only have been invoked once", function () {
                    expect( destData.length ).to.be( 1 );
                    expect( destEnv.length ).to.be( 1 );
                } );
                it( "linked subscription data should match expected results", function () {
                    expect( destData[0] ).to.be( "I'm in yer bus, linkin' to yer subscriptionz..." );
                } );
                it( "linked subscription envelope should match expected results", function () {
                    expect( destEnv[0].channel ).to.be( "destinationChannel" );
                    expect( destEnv[0].topic ).to.be( "kthxbye" );
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
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
                    linkages[0].unsubscribe();
                    postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
                } );
                after( function () {
                    postal.utils.reset();
                } );
                it( "linked subscription should only have been invoked once", function () {
                    expect( destData.length ).to.be( 1 );
                    expect( destEnv.length ).to.be( 1 );
                } );
                it( "linked subscription data should match expected results", function () {
                    expect( destData[0] ).to.be( "I'm in yer bus, linkin' to yer subscriptionz..." );
                } );
                it( "linked subscription envelope should match expected results", function () {
                    expect( destEnv[0].channel ).to.be( "destinationChannel" );
                    expect( destEnv[0].topic ).to.be( "NewTopic.Oh.Hai.There" );
                } );
            } );
        } );
        describe( "When binding channel - one source to multiple destinations", function () {
            var destData = [],
                destEnv = [],
                callback = function ( data, env ) {
                    destData.push( data );
                    destEnv.push( env );
                };

            before( function () {
                linkages = postal.linkChannels(
                    { channel : "sourceChannel", topic : "Oh.Hai.There" },
                    [
                        { channel : "destinationChannel", topic : "NewTopic.Oh.Hai" },
                        { channel : "destinationChannel", topic : "NewTopic.Oh.Hai.There" }
                    ] );
                postal.subscribe( { channel : "destinationChannel", topic : "NewTopic.Oh.Hai", callback : callback} );
                postal.subscribe( { channel : "destinationChannel", topic : "NewTopic.Oh.Hai.There", callback : callback } );
                postal.publish( { channel : "sourceChannel", topic : "Oh.Hai.There", data : "I'm in yer bus, linkin' to yer subscriptionz..."} );
            } );
            after( function () {
                postal.utils.reset();
            } );
            it( "linked subscriptions should each have been called once", function () {
                expect( destData.length ).to.be( 2 );
                expect( destEnv.length ).to.be( 2 );
            } );
        } );
    } );
}());