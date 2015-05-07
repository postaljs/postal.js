/* global postal */
describe( "postal.js - publishing", function() {
	describe( "when publishing to a new topic", function() {
		it( "should create cache entry", function() {
			postal.cache.should.not.have.property( "Doctor|Dont.Blink" ); //jshint ignore:line
			var subA = postal.subscribe( { channel: "Doctor", topic: "Dont.Blink", callback: function() {} } );
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
	describe( "when using envelope header `resolverNoCache`", function() {
		beforeEach( function() {
			postal.reset();
			postal.configuration.autoCompactResolver = true;
		} );
		afterEach( function() {
			postal.configuration.autoCompactResolver = false;
		} );
		it( "should not add a resolver cache entry if set to true", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			var subB = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {} } );
			postal.publish( {
				channel: "clara",
				topic: "run.you.clever.boy",
				data: "RYCB",
				headers: {
					resolverNoCache: true
				}
			} );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "bad.wolf|bad.wolf" );
			subB.unsubscribe();
			postal.configuration.resolver.cache.should.not.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
		} );
		it( "should add a resolver cache entry if explicitly set to false", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			var subB = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {} } );
			postal.publish( {
				channel: "clara",
				topic: "run.you.clever.boy",
				data: "RYCB",
				headers: {
					resolverNoCache: false
				}
			} );
			postal.configuration.resolver.cache.should.not.have.ownProperty( "bad.wolf|bad.wolf" );
			subB.unsubscribe();
			postal.configuration.resolver.cache.should.have.ownProperty( "run.you.clever.boy|run.you.clever.*" );
		} );
		it( "should not add a subscription cache entry if set to true", function() {
			postal.publish( {
				channel: "clara",
				topic: "run.you.clever.boy",
				data: "RYCB",
				headers: {
					resolverNoCache: true
				}
			} );
			postal.cache.should.not.have.ownProperty( "clara" + postal.configuration.cacheKeyDelimiter + "run.you.clever.boy" );
		} );
		it( "should add a subscription cache entry if explicitly set to false", function() {
			var subA = postal.subscribe( { channel: "clara", topic: "run.you.clever.*", callback: function() {} } );
			postal.publish( {
				channel: "clara",
				topic: "run.you.clever.boy",
				data: "RYCB!!",
				headers: {
					resolverNoCache: false
				}
			} );
			postal.cache.should.have.ownProperty( "clara" + postal.configuration.cacheKeyDelimiter + "run.you.clever.boy" );
		} );
	} );

	describe( "when publishing with a callback", function() {
		it( "should provide correct counts for both activated and skipped subscriptions", function() {
			var subACount = 0;
			var subBCount = 0;
			var subCCount = 0;
			var subDCount = 0;
			var subA = postal.subscribe( { channel: "rose", topic: "bad.wolf", callback: function() {
				subACount++;
			} } );
			var subB = postal.subscribe( { channel: "rose", topic: "*.wolf", callback: function() {
				subBCount++;
			} } );
			var subC = postal.subscribe( { channel: "rose", topic: "bad.*", callback: function() {
				subCCount++;
			} } );
			var subD = postal.subscribe( { channel: "rose", topic: "#", callback: function() {
					subDCount++;
				}
			} ).constraint( function( x ) {
				return x.series === 1 || x.series === 2 || x.series === 4;
			} );

			var episodes = [
				{ channel: "rose", topic: "bad.wolf", data: { ep: 1, series: 1 } },
				{ channel: "rose", topic: "sonic.wolf", data: { ep: 2, series: 2 } },
				{ channel: "rose", topic: "bad.sushi", data: { ep: 3, series: 3 } },
				{ channel: "rose", topic: "good.doctor", data: { ep: 4, series: 4 } }
			];

			var metadata = {};

			episodes.forEach( function( episode ) {
				postal.publish( episode, function( result ) {
					metadata[ episode.data.ep ] = result;
				} );
			} );

			// verify the expected subscription calls
			subACount.should.equal( 1 );
			subBCount.should.equal( 2 );
			subCCount.should.equal( 2 );
			subDCount.should.equal( 3 );

			// verify that each message activated the expected subscriptions
			// and that the constraint incremented the skipped counter
			metadata.should.eql( {
				1: { activated: 4, skipped: 0 },
				2: { activated: 2, skipped: 0 },
				3: { activated: 1, skipped: 1 },
				4: { activated: 1, skipped: 0 }
			} );
		} );
	} );
} );
