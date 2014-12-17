/* global postal */
var bindingsResolver = postal.configuration.resolver;

describe( "amqpBindingsResolver", function() {
	describe( "When calling compare", function() {
		beforeEach( function() {
			bindingsResolver.reset();
		} );
		describe( "and caching comparisons", function() {
			it( "should cache a passing comparison", function() {
				bindingsResolver.compare( "test", "test" );
				bindingsResolver.cache.should.have.ownProperty( "test|test" );
				bindingsResolver.cache[ "test|test" ].should.be.ok;
			} );
			it( "should cache a failing comparison", function() {
				bindingsResolver.compare( "nope", "test" );
				bindingsResolver.cache.should.have.ownProperty( "test|nope" );
				bindingsResolver.cache[ "test|nope" ].should.not.be.ok;
			} );
			it( "should purge the cache when calling purge with no arguments", function() {
				bindingsResolver.compare( "test", "test" );
				bindingsResolver.compare( "nope", "test" );
				bindingsResolver.cache.should.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.have.ownProperty( "test|nope" );
				bindingsResolver.purge();
				( bindingsResolver.cache ).should.be.empty;
			} );
			it( "should purge the topics specified when calling purge", function() {
				bindingsResolver.compare( "test", "test" );
				bindingsResolver.compare( "nope", "test" );
				bindingsResolver.compare( "test", "nope" );
				bindingsResolver.cache.should.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.have.ownProperty( "test|nope" );
				bindingsResolver.cache.should.have.ownProperty( "nope|test" );
				bindingsResolver.purge( { topic: "test" } );
				( bindingsResolver.cache ).should.have.ownProperty( "nope|test" );
				bindingsResolver.cache.should.not.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.not.have.ownProperty( "test|nope" );
			} );
			it( "should purge the bindings specified when calling purge", function() {
				bindingsResolver.compare( "test", "test" );
				bindingsResolver.compare( "nope", "test" );
				bindingsResolver.compare( "test", "nope" );
				bindingsResolver.cache.should.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.have.ownProperty( "test|nope" );
				bindingsResolver.cache.should.have.ownProperty( "nope|test" );
				bindingsResolver.purge( { binding: "test" } );
				( bindingsResolver.cache ).should.have.ownProperty( "test|nope" );
				bindingsResolver.cache.should.not.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.not.have.ownProperty( "nope|test" );
			} );
			it( "should return a valid result when disabling caching using an option parameter", function() {
				bindingsResolver.compare( "test", "test", { resolverNoCache: true } ).should.equal( true );
				bindingsResolver.compare( "test", "nope", { resolverNoCache: true } ).should.equal( false );
				bindingsResolver.cache.should.not.have.ownProperty( "test|test" );
				bindingsResolver.cache.should.not.have.ownProperty( "test|nope" );
				bindingsResolver.cache.should.not.have.ownProperty( "nope|test" );
			} );
		} );
		describe( "and not caching comparisons", function() {
			before( function() {
				postal.configuration.resolver.enableCache = false;
			} );
			after( function() {
				postal.configuration.resolver.enableCache = true;
			} );
			it( "should NOT cache a passing comparison", function() {
				bindingsResolver.compare( "test", "test" );
				bindingsResolver.cache.should.be.empty;
			} );
			it( "should NOT cache a failing comparison", function() {
				bindingsResolver.compare( "nope", "test" );
				bindingsResolver.cache.should.be.empty;
			} );
		} );
		describe( "With '*' wildcards", function() {
			// Passing matches
			describe( "With topic Top.Middle.Bottom and binding *.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "*.Middle.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|*.Middle.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding Top.*.Bottom", function() {
				var result = bindingsResolver.compare( "Top.*.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.*.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding Top.Middle.*", function() {
				var result = bindingsResolver.compare( "Top.Middle.*", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.Middle.*" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding Top.*.*", function() {
				var result = bindingsResolver.compare( "Top.*.*", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.*.*" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding Top.*.*", function() {
				var result = bindingsResolver.compare( "*.*.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|*.*.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding *.Middle.*", function() {
				var result = bindingsResolver.compare( "*.Middle.*", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|*.Middle.*" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding *.*.*", function() {
				var result = bindingsResolver.compare( "*.*.*", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|*.*.*" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );

			// Failing Matches
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding *.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "*.Middle.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|*.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.*.Bottom", function() {
				var result = bindingsResolver.compare( "Top.*.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|Top.*.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.Middle.*", function() {
				var result = bindingsResolver.compare( "Top.Middle.*", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|Top.Middle.*" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.*.*", function() {
				var result = bindingsResolver.compare( "Top.*.*", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|Top.*.*" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.*.*", function() {
				var result = bindingsResolver.compare( "*.*.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|*.*.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding *.Middle.*", function() {
				var result = bindingsResolver.compare( "*.Middle.*", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|*.Middle.*" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding *.*.*", function() {
				var result = bindingsResolver.compare( "*.*.*", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|*.*.*" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
		} );
		describe( "With '#' wildcards", function() {
			// Passing matches
			// # at beginning of binding
			describe( "With topic Top.Middle.Bottom and binding #.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|#.Middle.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Middle.Bottom and binding #.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Top.SubTop.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Middle.Bottom|#.Middle.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Middle.Bottom and binding #.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Middle.Bottom|#.Middle.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			// # in middle of binding
			describe( "With topic Top.Middle.Bottom and binding Top.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.#.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|Top.#.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Middle.SubMiddle.Bottom and binding Top.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Bottom", "Top.SubTop.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Middle.SubMiddle.Bottom|Top.#.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Bottom and binding Top.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Bottom|Top.#.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			// # at end of binding
			describe( "With topic Top.Middle.Bottom and binding Top.Middle.#", function() {
				var result = bindingsResolver.compare( "Top.Middle.#", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.Middle.#" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Middle.Bottom and binding Top.SubTop.#", function() {
				var result = bindingsResolver.compare( "Top.SubTop.#", "Top.SubTop.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Middle.Bottom|Top.SubTop.#" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Middle.Bottom and binding Middle.#", function() {
				var result = bindingsResolver.compare( "Middle.#", "Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Middle.Bottom|Middle.#" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			// Failing matches
			// # at beginning of binding
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding #.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|#.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Middle.SubMiddle.Bottom and binding #.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Top.SubTop.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Middle.SubMiddle.Bottom|#.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Middle.Bottom and binding #.Middle.SubMiddle.Bottom", function() {
				var result = bindingsResolver.compare( "#.Middle.Bottom", "Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Middle.SubMiddle.Bottom|#.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			// # in middle of binding
			describe( "With topic Top.Middle.Bottom and binding Top.SubTop.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.SubTop.#.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.SubTop.#.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom.SubBottom and binding Top.#.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Middle.SubMiddle.Bottom.SubBottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom.SubBottom|Top.#.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Middle.SubMiddle.Bottom and binding Top.#.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "Top.#.Middle.Bottom", "Top.SubTop.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Middle.SubMiddle.Bottom|Top.#.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.SubTop.Bottom and binding SubTop.#.Bottom", function() {
				var result = bindingsResolver.compare( "SubTop.#.Bottom", "Top.SubTop.Bottom" ),
					cached = bindingsResolver.cache[ "Top.SubTop.Bottom|SubTop.#.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			// # at end of binding
			describe( "With topic Top.Bottom and binding Top.Middle.#", function() {
				var result = bindingsResolver.compare( "Top.Middle.#", "Top.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Bottom|Top.Middle.#" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.Bottom and binding Top.SubTop.#", function() {
				var result = bindingsResolver.compare( "Top.SubTop.#", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.SubTop.#" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Bottom and binding Middle.#", function() {
				var result = bindingsResolver.compare( "Middle.#", "Bottom" ),
					cached = bindingsResolver.cache[ "Bottom|Middle.#" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
		} );
		describe( "With both '#' and '*' wildcards", function() {
			// Passing matches
			describe( "With topic Top.Middle.Bottom and binding #.*.Bottom", function() {
				var result = bindingsResolver.compare( "#.*.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|#.*.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding #.*.Bottom", function() {
				var result = bindingsResolver.compare( "#.*.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|#.*.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Bottom and binding #.*.Bottom", function() {
				var result = bindingsResolver.compare( "#.*.Bottom", "Top.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Bottom|#.*.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic Top.Bottom and binding *.#.Bottom", function() {
				var result = bindingsResolver.compare( "*.#.Bottom", "Top.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Bottom|*.#.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			// Failing matches
			describe( "With topic Bottom and binding #.*.Bottom", function() {
				var result = bindingsResolver.compare( "#.*.Bottom", "Bottom" ),
					cached = bindingsResolver.cache[ "Bottom|#.*.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.Middle.SubMiddle.#.*.Bottom", function() {
				var result = bindingsResolver.compare( "Top.Middle.SubMiddle.#.*.Bottom", "Top.Middle.SubMiddle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.SubMiddle.Bottom|Top.Middle.SubMiddle.#.*.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
			describe( "With topic Top.Bottom and binding #.*.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "#.*.Middle.Bottom", "Top.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Bottom|#.*.Middle.Bottom" ];
				it( "Result should be false", function() {
					result.should.not.be.ok;
				} );
				it( "Should *not* create a resolver cache entry", function() {
					cached.should.not.be.ok;
				} );
			} );
		} );
		describe( "With plain string matching", function() {
			describe( "With topic Top.Middle.Bottom and binding Top.Middle.Bottom", function() {
				var result = bindingsResolver.compare( "Top.Middle.Bottom", "Top.Middle.Bottom" ),
					cached = bindingsResolver.cache[ "Top.Middle.Bottom|Top.Middle.Bottom" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic 'Topic' and binding 'Topic'", function() {
				var result = bindingsResolver.compare( "Topic", "Topic" ),
					cached = bindingsResolver.cache[ "Topic|Topic" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
			describe( "With topic '/sample/topic' and binding '/sample/topic'", function() {
				var result = bindingsResolver.compare( "/sample/topic", "/sample/topic" ),
					cached = bindingsResolver.cache[ "/sample/topic|/sample/topic" ];
				it( "Result should be true", function() {
					result.should.be.ok;
				} );
				it( "Should create a resolver cache entry", function() {
					cached.should.be.ok;
				} );
			} );
		} );
	} );
} );
