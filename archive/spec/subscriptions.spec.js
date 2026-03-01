/* global postal, _ */

var sinon = require( "sinon" );

var subFactory = ( function() {
	var idx = 0;
	return {
		next: function( callback ) {
			idx++;
			return postal.subscribe( {
				channel: "test-channel-" + idx,
				topic: "topicky.topic." + idx,
				callback: callback
			} );
		}
	};
}() );

var NO_OP = function() {};
var systemMessages = [];

describe( "postal.js - subscriptions", function() {
	describe( "When using the SubscriptionDefinition constructor", function() {
		it( "should throw an exception if topic is missing", function() {
			( function() {
				var sub = new postal.SubscriptionDefinition( "meh", function() {} );
			} ).should.throw();
		} );
		it( "should throw an exception if channel is missing", function() {
			( function() {
				var sub = new postal.SubscriptionDefinition( "blah", function() {} );
			} ).should.throw();
		} );
		it( "should throw an exception if callback is missing", function() {
			( function() {
				var sub = new postal.SubscriptionDefinition( "meh", "blah" );
			} ).should.throw();
		} );
		it( "should throw an exception if topic is empty", function() {
			( function() {
				var sub = new postal.SubscriptionDefinition( "blah", "", function() {} );
			} ).should.throw();
		} );
	} );
	describe( "When subscribing", function() {
		beforeEach( function() {
			postal.reset();
			var systemSub = postal.subscribe( {
				channel: "postal",
				topic: "#",
				callback: function( data, env ) {
					systemMessages.push( env );
				}
			} );
			systemMessages = [];
		} );
		it( "should create a subscriptions lookup", function() {
			var result;
			var sub = subFactory.next( NO_OP );
			postal.subscriptions[ sub.channel ][ sub.topic ].should.be.an.Array.and.have.lengthOf( 1 );
		} );
		it( "should update lookup cache when new subscribers are added", function() {
			var channel = "lookup-update";
			var topic = "something.important";
			var cacheKey = channel + "|" + topic;
			var stubA = sinon.stub();
			var subA = postal.subscribe({ channel: channel, topic: topic, callback: stubA });
			var stubB = sinon.stub();
			var subB;
			postal.publish({ channel: channel, topic: topic, data: "hai" });
			postal.cache[ cacheKey ].should.be.an.Array.and.have.lengthOf( 1 );
			sinon.assert.calledOnce(stubA);
			subB = postal.subscribe({ channel: channel, topic: topic, callback: stubB });
			postal.cache[ cacheKey ].should.be.an.Array.and.have.lengthOf( 2 );
			postal.publish({ channel: channel, topic: topic, data: "hai" });
			sinon.assert.calledTwice(stubA);
			sinon.assert.calledOnce(stubB);
		});
		it( "should publish a subscription created message", function() {
			var sub = subFactory.next( NO_OP );
			systemMessages[ 0 ].topic.should.equal( "subscription.created" );
			systemMessages[ 0 ].data.should.eql( {
				event: "subscription.created",
				channel: sub.channel,
				topic: sub.topic
			} );
		} );
		it( "should receive a message", function() {
			var res;
			var sub = subFactory.next( function( d, e ) {
				res = e;
			} );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Fantastic!" }
			} );
			res.data.should.eql( { msg: "Fantastic!" } );
		} );
	} );
	describe( "When calling `subscribe` on a SubscriptionDefinition", function() {
		var res, name;
		var ctxObj = { name: "Rose" };
		var sub = subFactory.next( function( d, e ) {
			res = "original";
			name = this.name;
		} ).context( ctxObj ).subscribe( function( d, e ) {
			res = "other";
			name = this.name;
		} );
		postal.publish( {
			channel: sub.channel,
			topic: sub.topic,
			data: { msg: "Bad Wolf" }
		} );
		res.should.equal( "other" );
		name.should.equal( "Rose" );
	} );
	describe( "When subscribing with catch()", function() {
		it( "should catch an exception thrown by a subscriber", function() {
			var name, err;
			var ctxObj = { name: "Rose" };
			var sub = subFactory.next( function( d, e ) {
				name = this.name;
				throw new Error( "Oopsies" );
			} ).context( ctxObj ).catch( function( e ) {
				err = e;
				name.should.equal( "Rose" );
				( e instanceof Error ).should.equal( true );
			} );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Bad Wolf" }
			} );
		} );
	} );
	describe( "When subscribing and specifying the context", function() {
		it( "should set the context on the SubscriptionDefinition", function() {
			var res;
			var ctxObj = { name: "Rose" };
			var sub = subFactory.next( function( d, e ) {
				res = this.name + " says, '" + d.msg + "'.";
			} ).context( ctxObj );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Bad Wolf" }
			} );
			res.should.eql( "Rose says, 'Bad Wolf'." );
		} );
	} );
	describe( "When subscribing with `defer`", function() {
		it( "should defer the subscription invocation", function( done ) {
			var res = [];
			var ctxObj = { name: "Rose" };
			var sub = subFactory.next( function( d, e ) {
				res.push( this.name + " says, '" + d.msg + "'." );
				res[ 0 ].should.eql( "first" );
				res[ 1 ].should.eql( "Rose says, 'Bad Wolf'." );
				done();
			} ).defer().context( ctxObj );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Bad Wolf" }
			} );
			res.push( "first" );
		} );
	} );
	describe( "When subscribing with `disposeAfter`", function() {
		it( "should dispose the subscription after the correct number of invocations", function() {
			var res = [];
			var ctxObj = { name: "Wilfred Mott" };
			var name;
			var i = 0;
			var sub = subFactory.next( function( d, e ) {
				res.push( d.msg );
				name = this.name;
			} ).disposeAfter( 4 ).context( ctxObj );
			while ( i < 4 ) {
				postal.publish( {
					channel: sub.channel,
					topic: sub.topic,
					data: { msg: "Knock" }
				} );
				i++;
			}
			// He will knock four times....
			res.should.eql( [ "Knock", "Knock", "Knock", "Knock" ] );
			name.should.equal( "Wilfred Mott" );
		} );
		it( "should throw an exception if the provided argument is not a number", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).disposeAfter( "fantastic" );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
		it( "should throw an exception if the provided argument is not a number", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).disposeAfter( "fantastic" );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
	} );
	describe( "When subscribing with `distinct`", function() {
		describe( "and publishing an object", function() {
			it( "should only invoke the subscription callback as new/distinct data arrives", function() {
				var res = [];
				var expected = [ "Rose", "Martha", "Donna", "Amy", "Rory" ];
				var ctxObj = { name: "The Doctor" };
				var name;
				var sub = subFactory.next( function( d, e ) {
					res.push( d.companion );
					name = this.name;
				} ).distinct().context( ctxObj );

				var channel = postal.channel( sub.channel );

				channel.publish( sub.topic, { companion: "Rose" } );
				channel.publish( sub.topic, { companion: "Martha" } );
				channel.publish( sub.topic, { companion: "Donna" } );
				channel.publish( sub.topic, { companion: "Amy" } );
				channel.publish( sub.topic, { companion: "Rory" } );
				channel.publish( sub.topic, { companion: "Rose" } );
				channel.publish( sub.topic, { companion: "Martha" } );
				channel.publish( sub.topic, { companion: "Amy" } );

				res.should.eql( expected );
				name.should.equal( "The Doctor" );
			} );
		} );
		describe( "and publishing an array", function() {
			it( "should only invoke the subscription callback as new/distinct data arrives", function() {
				var res = [];
				var expected = [
					[ "Rose", "Jackie" ],
					[ "Martha" ],
					[ "Donna" ],
					[ "Amy", "Rory" ],
					[ "Rory" ]
				];
				var ctxObj = { name: "The Doctor" };
				var name;
				var sub = subFactory.next( function( d, e ) {
					res.push( d );
					name = this.name;
				} ).distinct().context( ctxObj );

				var channel = postal.channel( sub.channel );

				channel.publish( sub.topic, [ "Rose", "Jackie" ] );
				channel.publish( sub.topic, [ "Martha" ] );
				channel.publish( sub.topic, [ "Donna" ] );
				channel.publish( sub.topic, [ "Amy", "Rory" ] );
				channel.publish( sub.topic, [ "Rory" ] );
				channel.publish( sub.topic, [ "Rose", "Jackie" ] );
				channel.publish( sub.topic, [ "Martha" ] );
				channel.publish( sub.topic, [ "Amy", "Rory" ] );

				res.should.eql( expected );
				name.should.equal( "The Doctor" );
			} );
		} );
		describe( "and publishing a string", function() {
			it( "should only invoke the subscription callback as new/distinct data arrives", function() {
				var res = [];
				var expected = [ "Rose", "Martha", "Donna", "Amy", "Rory" ];
				var ctxObj = { name: "The Doctor" };
				var name;
				var sub = subFactory.next( function( d, e ) {
					res.push( d );
					name = this.name;
				} ).distinct().context( ctxObj );

				var channel = postal.channel( sub.channel );

				channel.publish( sub.topic, "Rose" );
				channel.publish( sub.topic, "Martha" );
				channel.publish( sub.topic, "Donna" );
				channel.publish( sub.topic, "Amy" );
				channel.publish( sub.topic, "Rory" );
				channel.publish( sub.topic, "Rose" );
				channel.publish( sub.topic, "Martha" );
				channel.publish( sub.topic, "Amy" );

				res.should.eql( expected );
				name.should.equal( "The Doctor" );
			} );
		} );
	} );
	describe( "When subscribing with `distinctUntilChanged`", function() {
		describe( "and publishing an object", function() {
			it( "should only invoke the subscription callback as new data not matching last published data arrives", function() {
				var res = [];
				var expected = [ "Rose", "Martha", "Donna", "Amy", "Rory", "Rose", "Martha" ];
				var ctxObj = { name: "The Doctor" };
				var name;
				var sub = subFactory.next( function( d, e ) {
					res.push( d.companion );
					name = this.name;
				} ).distinctUntilChanged().context( ctxObj );

				var channel = postal.channel( sub.channel );

				channel.publish( sub.topic, { companion: "Rose" } );
				channel.publish( sub.topic, { companion: "Rose" } );
				channel.publish( sub.topic, { companion: "Martha" } );
				channel.publish( sub.topic, { companion: "Donna" } );
				channel.publish( sub.topic, { companion: "Donna" } );
				channel.publish( sub.topic, { companion: "Amy" } );
				channel.publish( sub.topic, { companion: "Rory" } );
				channel.publish( sub.topic, { companion: "Rose" } );
				channel.publish( sub.topic, { companion: "Martha" } );
				channel.publish( sub.topic, { companion: "Martha" } );

				res.should.eql( expected );
				name.should.equal( "The Doctor" );
			} );
		} );
		describe( "and publishing a string", function() {
			it( "should only invoke the subscription callback as new data not matching last published data arrives", function() {
				var res = [];
				var expected = [ "Rose", "Martha", "Donna", "Amy", "Rory", "Rose", "Martha" ];
				var ctxObj = { name: "The Doctor" };
				var name;
				var sub = subFactory.next( function( d, e ) {
					res.push( d );
					name = this.name;
				} ).distinctUntilChanged().context( ctxObj );

				var channel = postal.channel( sub.channel );

				channel.publish( sub.topic, "Rose" );
				channel.publish( sub.topic, "Rose" );
				channel.publish( sub.topic, "Martha" );
				channel.publish( sub.topic, "Donna" );
				channel.publish( sub.topic, "Donna" );
				channel.publish( sub.topic, "Amy" );
				channel.publish( sub.topic, "Rory" );
				channel.publish( sub.topic, "Rose" );
				channel.publish( sub.topic, "Martha" );
				channel.publish( sub.topic, "Martha" );

				res.should.eql( expected );
				name.should.equal( "The Doctor" );
			} );
		} );
	} );
	describe( "when subscribing with `logError`", function() {
		it( "should log exceptions to the console", function() {
			var _log = console.log;
			var _warn = console.warn;
			var err;
			console.log = function() {
				err = Array.prototype.slice.call( arguments, 0 ).join( " " );
			};
			console.warn = function() {
				err = Array.prototype.slice.call( arguments, 0 ).join( " " );
			};
			var sub = subFactory.next( function( d, e ) {
				throw new Error( "Oopsies" );
			} ).catch().logError();
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { foo: "bar" }
			} );
			err.should.be.ok; //jshint ignore:line
			console.log = _log;
			console.warn = _warn;
		} );
		it( "should fallback to console.log if console.warn is undefined", function() {
			var _log = console.log;
			var _warn = console.warn;
			var err;
			console.log = function() {
				err = Array.prototype.slice.call( arguments, 0 ).join( " " );
			};
			console.warn = undefined;
			var sub = subFactory.next( function( d, e ) {
				throw new Error( "Oopsies" );
			} ).catch().logError();
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { foo: "bar" }
			} );
			err.should.be.ok; //jshint ignore:line
			console.log = _log;
			console.warn = _warn;
		} );
	} );
	describe( "When subscribing with `once`", function() {
		it( "should only invoke the subscription callback once", function() {
			var res = [];
			var ctxObj = { actor: "Christopher Eccleston" };
			var name;
			var i = 1;
			var sub = subFactory.next( function( d, e ) {
				res.push( d.msg );
				name = this.actor;
			} ).once().context( ctxObj );
			while ( i < 5 ) {
				postal.publish( {
					channel: sub.channel,
					topic: sub.topic,
					data: { msg: "Season " + i }
				} );
				i++;
			}
			res.should.eql( [ "Season 1" ] );
			name.should.equal( "Christopher Eccleston" );
		} );
	} );
	describe( "When subscribing with `constraint`", function() {
		it( "should invoke the subscription if constraint returns true", function() {
			var res = [];
			var ctxObj = { actor: "David Tennant" };
			var name;
			var i = 1;
			var sub = subFactory.next( function( d, e ) {
				res.push( d.season );
			} ).constraint( function( d, e ) {
				name = this.actor;
				return ( d.season >= 2 && d.season <= 4 );
			} ).context( ctxObj );
			while ( i < 8 ) {
				postal.publish( {
					channel: sub.channel,
					topic: sub.topic,
					data: { season: i }
				} );
				i++;
			}
			res.should.eql( [ 2, 3, 4 ] );
			name.should.equal( "David Tennant" );
		} );
		it( "should not invoke the subscription if constraint returns false", function() {
			var res = [];
			var ctxObj = { actor: "Matt Smith" };
			var name;
			var i = 1;
			var sub = subFactory.next( function( d, e ) {
				res.push( d.season );
			} ).constraint( function( d, e ) {
				name = this.actor;
				return ( d.season >= 5 && d.season <= 8 );
			} ).context( ctxObj );
			while ( i < 5 ) {
				postal.publish( {
					channel: sub.channel,
					topic: sub.topic,
					data: { season: i }
				} );
				i++;
			}
			res.should.eql( [] );
			name.should.equal( "Matt Smith" );
		} );
		it( "should throw an exception if the value provided is not a function", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).constraint( 123 );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
	} );
	describe( "When subscribing with `constraints`", function() {
		it( "should invoke the subscription if *all* constraints return true", function() {
			var res = "";
			var ctxObj = { name: "Clara Oswald" };
			var nameA;
			var nameB;
			var i = 1;
			var sub = subFactory.next( function( d, e ) {
				res = d.msg;
			} ).constraints( [ function( d, e ) {
					this.should.equal( ctxObj );
					return /clever boy/.test( d.msg );
				}, function( d, e ) {
					this.should.equal( ctxObj );
					return /Run you/.test( d.msg );
				}
			] ).context( ctxObj );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Run you clever boy" }
			} );
			res.should.equal( "Run you clever boy" );
		} );
		it( "should not invoke the subscription if *any* constraints return false", function() {
			var res = "";
			var ctxObj = { name: "Clara Oswald" };
			var nameA;
			var nameB;
			var i = 1;
			var sub = subFactory.next( function( d, e ) {
				res = d.msg;
			} ).constraints( [ function( d, e ) {
					this.should.equal( ctxObj );
					return /clever boy/.test( d.msg );
				}, function( d, e ) {
					this.should.equal( ctxObj );
					return /Walk you/.test( d.msg );
				}
			] ).context( ctxObj );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: { msg: "Run you clever boy" }
			} );
			res.should.equal( "" );
		} );
	} );
	describe( "When subscribing with `debounce`", function() {
		it( "should not invoke subscription callback more than expected", function( done ) {
			var results = [];
			var name;
			var sub = subFactory.next( function( d, e ) {
				name = this.name;
				results.push( d );
			} ).debounce( 800 ).context( { name: "Mickey" } );
			var channel = postal.channel( sub.channel );
			channel.publish( sub.topic, 1 ); // starts the two second clock on debounce
			setTimeout( function() {
				channel.publish( sub.topic, 2 );
			}, 20 ); // should not invoke callback
			setTimeout( function() {
				channel.publish( sub.topic, 3 );
			}, 80 ); // should not invoke callback
			setTimeout( function() {
				channel.publish( sub.topic, 4 );
			}, 250 ); // should not invoke callback
			setTimeout( function() {
				channel.publish( sub.topic, 5 );
			}, 500 ); // should not invoke callback
			setTimeout( function() {
				channel.publish( sub.topic, 6 );
			}, 1000 ); // should invoke callback
			setTimeout( function() {
				results[ 0 ].should.equal( 6 );
				results.length.should.equal( 1 );
				name.should.equal( "Mickey" );
				done();
			}, 1900 );
		} );
		it( "should throw an exception if the value provided is not a number", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).debounce( "gently" );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
	} );
	describe( "When subscribing with `delay`", function() {
		it( "should not invoke the subscription callback before time period elapses", function( done ) {
			this.clock = sinon.useFakeTimers();
			var results = [];
			var sub = subFactory.next( function( d, e ) {
				this.name.should.equal( "Mickey" );
				results.push( "second" );
				done();
			} ).delay( 500 ).context( { name: "Mickey" } );
			postal.publish( {
				channel: sub.channel,
				topic: sub.topic,
				data: {}
			} );
			this.clock.tick( 100 );
			results.should.eql( [] );
			this.clock.tick( 510 );
			results.push( "first" );
			this.clock.restore();
		} );
		it( "should throw an exception if the value provided is not a number", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).delay( "gently" );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
	} );
	describe( "When subscribing with `withThrottle`", function() {
		it( "should not invoke subscription callback more than expected", function( done ) {
			var results = [];
			var sub = subFactory.next( function( d, e ) {
				this.name.should.equal( "Mickey" );
				results.push( d );
			} ).throttle( 500 ).context( { name: "Mickey" } );
			var channel = postal.channel( sub.channel );
			var throttlePub = function( x ) {
				channel.publish( sub.topic, x );
			};
			channel.publish( sub.topic, 1 );
			setTimeout( function() {
				channel.publish( sub.topic, 800 );
			}, 800 ); // should invoke callback
			for ( var i = 0; i < 20; i++ ) {
				throttlePub( i );
			}
			setTimeout( function() {
				results[ 0 ].should.equal( 1 );
				results[ 2 ].should.equal( 800 );
				results.length.should.equal( 3 );
				done();
			}, 1500 );
		} );
		it( "should throw an exception if the value provided is not a number", function() {
			try {
				var sub = subFactory.next( function( d, e ) {} ).throttle( "gently" );
			} catch ( ex ) {
				ex.should.be.instanceOf( Error );
			}
		} );
	} );
	describe( "When subscribing with multiple config options", function() {
		describe( "using defer, context and withConstraint", function() {
			it( "should defer, use correct context and only invoke subscription if constraint returns true", function( done ) {
				var sub, name;
				var i = 1;
				var received = 0;
				var res = [];
				var ctxObj = { actor: "David Tennant" };
				sub = subFactory.next( function( d, e ) {
					res.push( d.season );
					received++;
					if ( received === 3 ) {
						res.should.eql( [ "first", 2, 3, 4 ] );
						name.should.equal( "David Tennant" );
						done();
					}
				} ).constraint( function( d, e ) {
					name = this.actor;
					return ( d.season >= 2 && d.season <= 4 );
				} ).context( ctxObj ).defer();
				while ( i < 8 ) {
					postal.publish( {
						channel: sub.channel,
						topic: sub.topic,
						data: { season: i }
					} );
					i++;
				}
				res.push( "first" );
			} );
		} );
	} );
} );
