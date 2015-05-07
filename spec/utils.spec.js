/* global global, postal, _ */
var NO_OP = function() {};
describe( "postal.utils", function() {
	beforeEach( function() {
		postal.reset();
	} );
	describe( "When calling postal.getSubscribersFor", function() {
		it( "should return expected results", function() {
			var subs = [],
				i = 10;
			var ch1 = postal.channel( "MyChannel" ),
				ch2 = postal.channel( "MyChannel2" );
			while ( i ) {
				subs.push( ch1.subscribe( "MyTopic", NO_OP ) );
				if ( i % 2 === 0 ) {
					subs.push( ch2.subscribe( "MyTopic2", NO_OP ) );
				}
				i--;
			}
			postal.getSubscribersFor().length.should.equal( 15 );
			postal.getSubscribersFor( {
				channel: "MyChannel",
				topic: "MyTopic"
			} ).length.should.equal( 10 );
			postal.getSubscribersFor( {
				channel: "MyChannel2",
				topic: "MyTopic2"
			} ).length.should.equal( 5 );
		} );
	} );
	describe( "When calling postal.reset", function() {
		var resolver;
		var subscription;
		var sub;
		before( function() {
			subscription = postal.channel( "MyChannel" ).subscribe( "MyTopic", function() {} );
			postal.channel( "MyChannel" ).publish( "MyTopic", "Oh Hai!" );
			sub = postal.subscriptions.MyChannel.MyTopic[ 0 ];
			resolver = postal.configuration.resolver.cache[ "MyTopic-MyTopic" ];
			postal.reset();
		} );
		after( function() {} );
		it( "should have created a subscription definition", function() {
			sub.channel.should.equal( "MyChannel" );
			sub.topic.should.equal( "MyTopic" );
			( typeof sub._context === "undefined" ).should.be.ok;
		} );
		it( "subscriptions map should now be empty", function() {
			_.isEmpty( postal.subscriptions ).should.be.ok;
		} );
		it( "resolver cache should now be empty", function() {
			_.isEmpty( postal.configuration.resolver.cache ).should.be.ok;
		} );
	} );
	describe( "When calling postal.unsubscribeFor", function() {
		describe( "With a channel passed", function() {
			var subs = [];
			var res = 0;
			var cb = function() {
				res += 1;
			};
			beforeEach( function() {
				postal.reset();
				subs.push( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "even.more.topics",
					callback: cb
				} ) );
				postal.unsubscribeFor( {
					channel: "B"
				} );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "even.more.topics",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				postal.reset();
			} );
			it( "should have removed the whole channel", function() {
				( typeof postal.subscriptions.B === "undefined" ).should.be.ok;
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 0 );
			} );
		} );
		describe( "With a topic passed", function() {
			var subs = [];
			var res = 0;
			var cb = function( d, e ) {
				res += 1;
			};
			beforeEach( function() {
				subs.push( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "some.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ) );
				postal.unsubscribeFor( {
					channel: "B",
					topic: "some.topic"
				} );
				postal.publish( {
					channel: "B",
					topic: "some.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				subs = [];
				postal.reset();
			} );
			it( "should have removed correct subscribers", function() {
				( typeof postal.subscriptions.B[ "some.topic" ] === "undefined" ).should.be.ok;
			} );
			it( "should have kept subscribers in other topics", function() {
				postal.subscriptions.B[ "another.topic" ].length.should.equal( 1 );
			} );
			it( "should have kept subscribers in other channels", function() {
				postal.subscriptions.A[ "some.topic" ].length.should.equal( 1 );
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 1 );
			} );
		} );
		describe( "With a context passed", function() {
			var subs = [];
			var res = 0;
			var cb = function() {
				res += 1;
			};
			var obj = {
				foo: "bar"
			};
			beforeEach( function() {
				subs.push( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "even.more.topics",
					callback: cb
				} ).context( obj ) );
				postal.unsubscribeFor( {
					context: obj
				} );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "even.more.topics",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				subs = [];
				postal.reset();
			} );
			it( "should have removed correct subscribers", function() {
				( typeof postal.subscriptions.B[ "even.more.topics" ] === "undefined" ).should.be.ok;
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 1 );
			} );
		} );
		describe( "with a predicate passed", function() {
			var subs = [];
			var res = 0;
			var cb = function() {
				res += 1;
			};
			beforeEach( function() {
				subs.push( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ) );
				subs.push( postal.subscribe( {
					channel: "B",
					topic: "even.more.topics",
					callback: cb
				} ) );
				subs[ 2 ].someProp = "hai";
				postal.unsubscribeFor( function( sub ) {
					return sub.someProp === "hai";
				} );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "even.more.topics",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				subs = [];
				postal.reset();
			} );
			it( "should have removed correct subscribers", function() {
				( typeof postal.subscriptions.B[ "even.more.topics" ] === "undefined" ).should.be.ok;
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 1 );
			} );
		} );
		describe( "with a custom string property", function() {
			var subs = [];
			var res = 0;
			var cb = function() {
				res += 1;
			};
			beforeEach( function() {
				subs.push( _.extend( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ), { thingy: "some/string/[value]" } ) );
				subs.push( _.extend( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ), { thingy: "some/string/[value]" } ) );
				subs.push( _.extend( postal.subscribe( {
					channel: "B",
					topic: "even.more.topics",
					callback: cb
				} ), { thingy: "some/string/[value]" } ) );
				postal.unsubscribeFor( { channel: "B", thingy: "some/string/[value]" } );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "even.more.topics",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				subs = [];
				postal.reset();
			} );
			it( "should have removed correct subscribers", function() {
				( typeof postal.subscriptions.B === "undefined" ).should.be.ok;
				( typeof postal.subscriptions.B === "undefined" ).should.be.ok;
				( postal.subscriptions.A[ "some.topic" ] ).should.be.ok;
				postal.getSubscribersFor( { channel: "B", thingy: "some/string/[value]" } ).length.should.equal( 0 );
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 0 );
			} );
		} );
		describe( "with a custom object property", function() {
			var subs = [];
			var res = 0;
			var cb = function() {
				res += 1;
			};
			var objectyObj = { greeting: "oh, hai" };
			beforeEach( function() {
				subs.push( _.extend( postal.subscribe( {
					channel: "A",
					topic: "some.topic",
					callback: cb
				} ), { thingy: objectyObj } ) );
				subs.push( _.extend( postal.subscribe( {
					channel: "B",
					topic: "another.topic",
					callback: cb
				} ), { thingy: objectyObj } ) );
				subs.push( _.extend( postal.subscribe( {
					channel: "B",
					topic: "even.more.topics",
					callback: cb
				} ), { thingy: objectyObj } ) );
				postal.unsubscribeFor( { channel: "B", thingy: objectyObj } );
				postal.publish( {
					channel: "B",
					topic: "another.topic",
					data: {}
				} );
				postal.publish( {
					channel: "B",
					topic: "even.more.topics",
					data: {}
				} );
			} );
			afterEach( function() {
				res = 0;
				subs = [];
				postal.reset();
			} );
			it( "should have removed correct subscribers", function() {
				( typeof postal.subscriptions.B === "undefined" ).should.be.ok;
				( typeof postal.subscriptions.B === "undefined" ).should.be.ok;
				( postal.subscriptions.A[ "some.topic" ] ).should.be.ok;
				postal.getSubscribersFor( { channel: "B", thingy: objectyObj } ).length.should.equal( 0 );
			} );
			it( "should have not invoked subscriber callbacks when publishing", function() {
				res.should.equal( 0 );
			} );
		} );
	} );
	describe( "noConflict", function() {
		it( "should return control to the previous postal value", function() {
			if ( typeof window === "undefined" || ( typeof window !== "undefined" && typeof require === "function" && define.amd ) ) {
				var err = false;
				try {
					postal.noConflict();
				} catch ( e ) {
					err = true;
				}
				err.should.be.ok; //jshint ignore:line
			} else {
				var _postal = global.postal; // hang on to postal value
				postal.noConflict(); // return previous postal
				global.postal.foo.should.equal( "bar" );
				global.postal = _postal; // return postal back as it was
			}
		} );
	} );
} );
