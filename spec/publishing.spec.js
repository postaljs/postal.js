/* global postal */
describe( "postal.js - publishing", function() {
	describe( "when publishing to a new topic", function() {
		it( "should create cache entry", function() {
			postal.cache.should.not.have.property( "Doctor|Dont.Blink" ); //jshint ignore:line
			postal.publish( {
				channel: "Doctor",
				topic: "Dont.Blink",
				data: { weeping: true }
			} );
			postal.cache.should.have.property( "Doctor|Dont.Blink" );
		} );
	} );
	describe( "when autoCompactResolver is set to false", function() {
		before( function() {
			postal.reset();
			postal.configuration.autoCompactResolver = false;
		} );
		after( function() {
			postal.configuration.autoCompactResolver = false;
		} );
		it( "should not compact the resolver cache", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			var subB = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {} } );
			postal.publish( { channel: "clara", topic: "run.you.clever.boy", data: "RYCB" } );
			postal.publish( { channel: "clara", topic: "run.you.clever.doctor", data: "RYCB" } );
			postal.publish( { channel: "rose", topic: "bad.wolf", data: "bad wolf" } );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "bad.wolf|bad.wolf" );
			subA.unsubscribe();
			subB.unsubscribe();
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "bad.wolf|bad.wolf" );
		} );
	} );
	describe( "when autoCompactResolver is set to true", function() {
		beforeEach( function() {
			postal.reset();
			postal.configuration.autoCompactResolver = true;
		} );
		afterEach( function() {
			postal.configuration.autoCompactResolver = false;
		} );
		it( "should compact the resolver cache on every unsubscribe", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			var subB = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {} } );
			postal.publish( { channel: "clara", topic: "run.you.clever.boy", data: "RYCB" } );
			postal.publish( { channel: "clara", topic: "run.you.clever.doctor", data: "RYCB" } );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			subA.unsubscribe();
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.publish( { channel: "rose", topic: "bad.wolf", data: "bad wolf" } );
			postal.configuration.resolver.cache.should.have.ownProperty( "bad.wolf|bad.wolf" );
			subB.unsubscribe();
			postal.configuration.resolver.cache.should.not.have.ownProperty( "bad.wolf|bad.wolf" );
		} );
	} );
	describe( "when autoCompactResolver is set to a number", function() {
		beforeEach( function() {
			postal.reset();
			postal.configuration.autoCompactResolver = 2;
		} );
		afterEach( function() {
			postal.configuration.autoCompactResolver = false;
		} );
		it( "should compact the resolver cache once the unsubscribe threshold has been reached", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			var subB = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {} } );
			var subC = postal.subscribe( { channel: "amy", topic: "raggedy.*", callback: function() {} } );
			var subD = postal.subscribe( { channel: "rory", topic: "roman.centurion", callback: function() {} } );
			postal.publish( { channel: "clara", topic: "run.you.clever.boy", data: "RYCB" } );
			postal.publish( { channel: "clara", topic: "run.you.clever.doctor", data: "RYCB" } );
			postal.publish( { channel: "rose", topic: "bad.wolf", data: "bad wolf" } );
			postal.publish( { channel: "amy", topic: "raggedy.man", data: "girl who waited" } );
			postal.publish( { channel: "amy", topic: "raggedy.doctor", data: "girl who waited" } );
			postal.publish( { channel: "rory", topic: "roman.centurion", data: "" } );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "bad.wolf|bad.wolf" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.man|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.doctor|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "roman.centurion|roman.centurion" );
			subA.unsubscribe();
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "bad.wolf|bad.wolf" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.man|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.doctor|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "roman.centurion|roman.centurion" );
			subB.unsubscribe();
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "bad.wolf|bad.wolf" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.man|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.doctor|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "roman.centurion|roman.centurion" );
			subC.unsubscribe();
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.doctor|run.you.clever.*" );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "bad.wolf|bad.wolf" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.man|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "raggedy.doctor|raggedy.*" );
			postal.configuration.resolver.cache.should.have.ownProperty( "roman.centurion|roman.centurion" );
			subD.unsubscribe();
			postal.configuration.resolver.cache.should.be.empty;
		} );
	} );
} );
