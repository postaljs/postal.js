/* global describe, postal, it, after, before, expect, ConsecutiveDistinctPredicate */
describe( "ConsecutiveDistinctPredicate", function () {
	describe( "When calling the function with the same data multiple times", function () {
		var pred = new ConsecutiveDistinctPredicate(),
			data = { name : "Dr Who" },
			results = [];
		results.push( pred( data ) );
		results.push( pred( data ) );
		results.push( pred( data ) );

		it( "The first result should be true", function () {
			expect( results[0] ).to.be.ok();
		} );
		it( "The second result should be false", function () {
			expect( results[1] ).to.not.be.ok();
		} );
		it( "The third result should be false", function () {
			expect( results[2] ).to.not.be.ok();
		} );
	} );
	describe( "When calling the function with different data every time", function () {
		var predA = new ConsecutiveDistinctPredicate(),
			data = { name : "Amelia" },
			res = [];
		res.push( predA( data ) );
		data.name = "Rose";
		res.push( predA( data ) );
		data.name = "Martha";
		res.push( predA( data ) );

		it( "The first result should be true", function () {
			expect( res[0] ).to.be.ok();
		} );
		it( "The second result should be true", function () {
			expect( res[1] ).to.be.ok();
		} );
		it( "The third result should be true", function () {
			expect( res[2] ).to.be.ok();
		} );
	} );
	describe( "When calling the function with different data every two calls", function () {
		var predA = new ConsecutiveDistinctPredicate(),
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
			expect( res[0] ).to.be.ok();
		} );
		it( "The second result should be false", function () {
			expect( res[1] ).to.not.be.ok();
		} );

		it( "The third result should be isTrue", function () {
			expect( res[2] ).to.be.ok();
		} );
		it( "The fourth result should be false", function () {
			expect( res[3] ).to.not.be.ok();
		} );

		it( "The fifth result should be true", function () {
			expect( res[4] ).to.be.ok();
		} );
		it( "The sixth result should be false", function () {
			expect( res[5] ).to.not.be.ok();
		} );
	} );
} );