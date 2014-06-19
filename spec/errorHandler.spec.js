/* global describe, postal, it, after, before, expect */
( function() {
    var postal = typeof window === "undefined" ? require( "../lib/postal.js" ) : window.postal;
    var expect = typeof window === "undefined" ? require( "expect.js" ) : window.expect;
    var SubscriptionDefinition = postal.SubscriptionDefinition,
        callback = function() {
            throw new Error( 'uh oh' );
        },
        error, payload;

    describe( 'SubscriptionDefintion', function() {

        describe( 'when a subscriber throws an exception with an explicit handler', function() {
            var sDef;
            before( function( done ) {
                sDef = new SubscriptionDefinition( "SubDefTestChannel", "SubDefTestTopic", callback )
                    .catch ( function( err, args ) {
                        error = err.toString();
                        payload = args;
                        done();
                    } );
                sDef.callback( {
                    channel: "TestChannel",
                    topic: "TestTopic",
                    data: "Oh, hai"
                }, "Oh, hai" );
            } );

            it( 'should catch the correct error', function() {
                expect( error ).to.be( 'Error: uh oh' );
            } );

            it( 'should have the arguments published', function() {
                expect( payload ).to.eql( {
                    channel: "TestChannel",
                    topic: "TestTopic",
                    data: "Oh, hai"
                } );
            } );

            after( function() {
                sDef.unsubscribe();
            } );
        } );
    } );
}() );