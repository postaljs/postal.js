describe( "bindingsResolver", function () {
	describe( "When calling compare", function () {
		describe( "With topic Top.Middle.Bottom and binding Top.Middle.Bottom", function () {
			var result = classicBindingsResolver.compare( "Top.Middle.Bottom", "Top.Middle.Bottom" ),
				cached = classicBindingsResolver.cache["Top.Middle.Bottom"]["Top.Middle.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
		describe( "With topic Top.Middle.Bottom and binding Top.#.Bottom", function () {
			var result = classicBindingsResolver.compare( "Top.#.Bottom", "Top.Middle.Bottom" ),
				cached = classicBindingsResolver.cache["Top.Middle.Bottom"]["Top.#.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
		describe( "With topic Top.Middle.Bottom and binding Top.*.Bottom", function () {
			var result = classicBindingsResolver.compare( "Top.*.Bottom", "Top.Middle.Bottom" ),
				cached = classicBindingsResolver.cache["Top.Middle.Bottom"]["Top.*.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
		describe( "With topic Top.Middle.Bottom and binding #.*.Bottom", function () {
			var result = classicBindingsResolver.compare( "#.*.Bottom", "Top.Middle.Bottom" ),
				cached = classicBindingsResolver.cache["Top.Middle.Bottom"]["#.*.Bottom"];
			it( "Result should be true", function () {
				expect( result ).to.be.ok();
			} );
			it( "Should create a resolver cache entry", function () {
				expect( cached ).to.be.ok();
			} );
		} );
	} );
} );