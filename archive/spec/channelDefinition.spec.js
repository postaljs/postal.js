/* global postal */
describe( "ChannelDefinition", function() {
	beforeEach( function() {
		postal.reset();
	} );
	describe( "when subscribing from a ChannelDefinition", function() {
		it( "should return a SubscriptionDefinition", function() {
			var channel = postal.channel( "Dalek" );
			var sub = channel.subscribe( "exterminate", function() {} );
			sub.should.be.an.instanceOf( postal.SubscriptionDefinition );
		} );
		it( "should support method overloads", function() {
			var channel = postal.channel( "Dalek" );
			var cb = function() {};
			var sub1 = channel.subscribe( { topic: "exterminate", callback: cb } );
			var sub2 = channel.subscribe( "exterminate", cb );
			sub1.topic.should.equal( "exterminate" );
			sub1.callback.should.equal( cb );
			sub2.topic.should.equal( "exterminate" );
			sub2.callback.should.equal( cb );
		} );
	} );
	describe( "when publishing from a ChannelDefinition", function() {
		it( "should support method overloads", function() {
			var res = [];
			var channel = postal.channel( "Dalek" );
			var sub = channel.subscribe( "exterminate", function( d ) {
				res.push( d.msg );
			} );
			channel.publish( { topic: "exterminate", data: { msg: "Kill the Doctor!" } } );
			channel.publish( "exterminate", { msg: "Kill the Doctor!" } );
			res.should.eql( [ "Kill the Doctor!", "Kill the Doctor!" ] );
		} );
	} );
	describe( "when getting a ChannelDefinition instance", function() {
		it( "should default the channel name if not specified", function() {
			var ch = postal.channel();
			ch.channel.should.equal( postal.configuration.DEFAULT_CHANNEL );
		} );
	} );
	describe( "when publishing and subscribing directly on the channel with a callback", function() {
		it( "should provide correct counts for both activated and skipped subscriptions", function() {
			var channel = postal.channel( "Dalek" );
			var cb = function() {};

			var sub1 = channel.subscribe( { topic: "exterminate", callback: cb } ).constraint( function( x ) {
				return x.target !== "Dalek";
			} );

			channel.publish( "derpxterminate", { target: "The Doctor" }, function( result ) {
				result.should.eql( { activated: 0, skipped: 0 } );
			} );

			channel.publish( { topic: "exterminate", data: { target: "The Doctor" } }, function( result ) {
				result.should.eql( { activated: 1, skipped: 0 } );
			} );

			channel.publish( { topic: "exterminate", data: { target: "Dalek" } }, function( result ) {
				result.should.eql( { activated: 0, skipped: 1 } );
			} );
		} );
	} );
	describe( "when passing invalid arguments to publish", function() {
		it( "should throw an exception when not passing a string topic or envelope object", function() {
			var channel = postal.channel( "impossiblegirl" );
			( function() {
				channel.publish( 123 );
			} ).should.throw( /The first argument to ChannelDefinition.publish/ );
		} );
	} );
} );
