/* global postal */
describe( "wiretaps", function() {
	describe( "When subscribing and unsubscribing a wire tap", function() {
		var wireTapData,
			wireTapEnvelope,
			wireTapNesting,
			wiretap;
		before( function() {
			wireTapData = [];
			wireTapEnvelope = [];
			wireTapNesting = [];

			postal.subscribe( {
				topic: "Oh.Hai.There",
				callback: function() {
					postal.publish( {
						topic: "Oh.Hai.There.Nested",
						data: "I'm in yer bus, nested"
					} );
				}
			} );

			wiretap = postal.addWireTap( function( msg, envelope, nesting ) {
				wireTapData.push( msg );
				wireTapEnvelope.push( envelope );
				wireTapNesting.push( nesting );
			} );

			postal.publish( {
				topic: "Oh.Hai.There",
				data: "I'm in yer bus, tappin' yer subscriptionz..."
			} );
			wiretap();
			postal.publish( {
				topic: "Oh.Hai.There",
				data: "I'm in yer bus, tappin' yer subscriptionz..."
			} );
		} );
		after( function() {
			postal.reset();
		} );
		it( "wire tap should have been invoked only twice", function() {
			wireTapData.length.should.equal( 2 );
			wireTapEnvelope.length.should.equal( 2 );
			wireTapNesting.length.should.equal( 2 );
		} );
		it( "wireTap data should match expected results", function() {
			wireTapData[ 0 ].should.equal( "I'm in yer bus, tappin' yer subscriptionz..." );
		} );
		it( "wireTap envelope should match expected results", function() {
			wireTapEnvelope[ 0 ].channel.should.equal( postal.configuration.DEFAULT_CHANNEL );
			wireTapEnvelope[ 0 ].topic.should.equal( "Oh.Hai.There" );
		} );
		it( "wireTap nesting should match expected results", function() {
			wireTapNesting[ 0 ].should.equal( 1 );
			wireTapNesting[ 1 ].should.equal( 2 );
		} );
	} );
} );
