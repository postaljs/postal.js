
describe( "amqpBindingsResolver", function () {
	describe( "When calling compare", function () {
		describe( "With topic Top.Middle.Bottom and binding Top.Middle.Bottom", function () {
			var result = bindingsResolver.compare( "Top.Middle.Bottom", "Top.Middle.Bottom" ),
				cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.Middle.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
		describe( "With topic Top.Middle.Bottom and binding Top.#.Bottom", function () {
			var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Middle.Bottom" ),
				cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.#.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
  describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.#.Bottom", function () {
    var result = bindingsResolver.compare( "Top.#.Bottom", "Top.Middle.SubMiddle.Bottom" ),
      cached = bindingsResolver.cache["Top.Middle.SubMiddle.Bottom"]["Top.#.Bottom"];
    it( "Result should be true", function () {
      expect( result ).to.be.ok();
    } );
    it( "Should create a resolver cache entry", function () {
      expect( cached ).to.be.ok();
    } );
  } );
  describe( "With topic Top.SubTop.Middle.SubMiddle.Bottom and binding Top.#.Bottom", function () {
    var result = bindingsResolver.compare( "Top.#.Bottom", "Top.SubTop.Middle.SubMiddle.Bottom" ),
      cached = bindingsResolver.cache["Top.SubTop.Middle.SubMiddle.Bottom"]["Top.#.Bottom"];
    it( "Result should be true", function () {
      expect( result ).to.be.ok();
    } );
    it( "Should create a resolver cache entry", function () {
      expect( cached ).to.be.ok();
    } );
  } );
		describe( "With topic Top.Middle.Bottom and binding Top.*.Bottom", function () {
			var result = bindingsResolver.compare( "Top.*.Bottom", "Top.Middle.Bottom" ),
				cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.*.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
  describe( "With topic Top.Middle.SubMiddle.Bottom and binding Top.*.Bottom", function () {
    var result = bindingsResolver.compare( "Top.*.Bottom", "Top.Middle.SubMiddle.Bottom" ),
      cached = bindingsResolver.cache["Top.Middle.SubMiddle.Bottom"]["Top.*.Bottom"];
    it( "Result should be false", function () {
      expect( result ).to.not.be.ok()
    } );
    it( "Should *not* create a resolver cache entry", function () {
      expect( cached ).to.not.be.ok()
    } );
  } );
		describe( "With topic Top.Middle.Bottom and binding #.*.Bottom", function () {
			var result = bindingsResolver.compare( "#.*.Bottom", "Top.Middle.Bottom" ),
				cached = bindingsResolver.cache["Top.Middle.Bottom"]["#.*.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
	} );
} );