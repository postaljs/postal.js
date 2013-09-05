/* global describe, postal, it, after, before, expect, ChannelDefinition */
describe( "ChannelDefinition", function () {
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
			expect( sub instanceof SubscriptionDefinition ).to.be.ok();
		} );
	} );
	describe( "When publishing from a channel definition", function () {
		var channel, subscription;
		beforeEach( function () {
			channel = postal.channel( "OhHai" );
		} );
		afterEach( function () {
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