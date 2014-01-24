/* global describe, postal, it, after, before, expect */
(function(){
    var postal = typeof window === "undefined" ? require("../lib/postal.js")() : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var ChannelDefinition = postal.ChannelDefinition;
    describe( "channel definition", function () {
        describe( "When using global channel api", function () {
            var gch;
            describe( "With no channel name provided", function () {
                describe( "Using string argument", function () {
                    before( function () {
                        gch = postal.channel( "SomeChannel" );
                    } );
                    after( function () {
                        gch = undefined;
                    } );
                    it( "channel should be of type ChannelDefinition", function () {
                        expect( gch instanceof ChannelDefinition ).to.be.ok();
                    } );
                    it( "should set channel name to SomeChannel", function () {
                        expect( gch.channel ).to.be( "SomeChannel" );
                    } );
                } );
            } );
        } );
        describe( "When initializing a channel definition", function () {
            var chDef = new ChannelDefinition( "TestChannel" );
            it( "should set channel to TestChannel", function () {
                expect( chDef.channel ).to.be( "TestChannel" );
            } );
        } );
        describe( "When calling subscribe", function () {
            var ch = new ChannelDefinition( "TestChannel" ),
                sub = ch.subscribe( "TestTopic", function () {} );
            it( "subscription should be instance of SubscriptionDefinition", function () {
                expect( sub instanceof postal.SubscriptionDefinition ).to.be.ok();
            } );
        } );
        describe( "When publishing from a channel definition", function () {
            var channel, subscription;
            before( function () {
                channel = postal.channel( "OhHai" );
            } );
            after( function () {
                postal.utils.reset();
                channel = undefined;
                subscription = undefined;
            } );
            it( "Should allow a topic only to be used", function ( done ) {
                subscription = channel.subscribe( "topic.only", function ( d, e ) {
                    expect( typeof d === "undefined" ).to.be( true );
                    expect( e.topic ).to.be( "topic.only" );
                    done();
                } );
                channel.publish( "topic.only" );
            } );
            it( "Should allow a topic and data argument to be used", function ( done ) {
                subscription = channel.subscribe( "topic.and.data", function ( d, e ) {
                    expect( d ).to.be( "hai" );
                    expect( e.topic ).to.be( "topic.and.data" );
                    done();
                } );
                channel.publish( "topic.and.data", "hai" );
            } );
            it( "Should allow an envelope argument to be used", function ( done ) {
                subscription = channel.subscribe( "envelope", function ( d, e ) {
                    expect( e.channel ).to.be( "OhHai" );
                    expect( e.data ).to.be( "hai" );
                    expect( e.foo ).to.be( "bar" );
                    done();
                } );
                channel.publish( { topic : "envelope", data : "hai", foo : "bar" } );
            } );
        } );
    } );
}());