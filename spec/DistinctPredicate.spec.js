QUnit.specify( "postal.js", function () {
	describe( "DistinctPredicate", function () {
		describe( "When calling the function with the same data multiple times", function () {
			var pred = new DistinctPredicate(),
				data = { name : "Dr Who" },
				results = [];
			results.push( pred( data ) );
			results.push( pred( data ) );
			results.push( pred( data ) );

			it( "The first result should be true", function () {
				assert( results[0] ).isTrue();
			} );
			it( "The second result should be false", function () {
				assert( results[1] ).isFalse();
			} );
			it( "The third result should be false", function () {
				assert( results[2] ).isFalse();
			} );
		} );
		describe( "When calling the function with different data every time", function () {
			var predA = new DistinctPredicate(),
				data = { name : "Amelia" },
				res = [];
			res.push( predA( data ) );
			data.name = "Rose";
			res.push( predA( data ) );
			data.name = "Martha";
			res.push( predA( data ) );

			it( "The first result should be true", function () {
				assert( res[0] ).isTrue();
			} );
			it( "The second result should be true", function () {
				assert( res[1] ).isTrue();
			} );
			it( "The third result should be true", function () {
				assert( res[2] ).isTrue();
			} );
		} );
		describe( "When calling the function with different data every two calls", function () {
			var predA = new DistinctPredicate(),
				data = { name : "Amelia" },
				res = [];
			res.push( predA( data ) );
			res.push( predA( data ) );
			data.name = "Rose";
			res.push( predA( data ) );
			res.push( predA( data ) );
			data.name = "Martha";
			res.push( predA( data ) );
			res.push( predA( data ) );

			it( "The first result should be true", function () {
				assert( res[0] ).isTrue();
			} );
			it( "The second result should be false", function () {
				assert( res[1] ).isFalse();
			} );

			it( "The third result should be isTrue", function () {
				assert( res[2] ).isTrue();
			} );
			it( "The fourth result should be false", function () {
				assert( res[3] ).isFalse();
			} );

			it( "The fifth result should be true", function () {
				assert( res[4] ).isTrue();
			} );
			it( "The sixth result should be false", function () {
				assert( res[5] ).isFalse();
			} );
		} );
	} );
} );