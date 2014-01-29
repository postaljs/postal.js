/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js") : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var NO_OP = function () {};
    var SubscriptionDefinition = postal.SubscriptionDefinition;
    describe( "SubscriptionDefinition", function () {
        describe( "When initializing SubscriptionDefinition", function () {
            var sDef;
            before( function () {
                sDef = new SubscriptionDefinition( "SubDefTestChannel", "SubDefTestTopic", NO_OP );
            } );
            after( function () {
                sDef.unsubscribe();
            } );
            it( "should set the channel to SubDefTestChannel", function () {
                expect( sDef.channel ).to.be( "SubDefTestChannel" );
            } );
            it( "should set the topic to SubDefTestTopic", function () {
                expect( sDef.topic ).to.be( "SubDefTestTopic" );
            } );
            it( "should default the context", function () {
                expect( sDef.context ).to.be( undefined );
            } );
        } );

        describe( "When setting the context", function () {
            var obj = { name : "Rose" },
                name,
                sDefd = new SubscriptionDefinition( "TestChannel", "TestTopic", NO_OP )
                    .withContext( obj )
                    .withConstraint( function ( d, e ) {
                        name = this.name;
                        return true;
                    } );
            sDefd.callback({ channel : "TestChannel", topic : "TestTopic", data : "Oh, hai"}, "Oh, hai");

            it( "Should set context", function () {
                expect( sDefd.callback.context() ).to.be( obj );
            } );
            it( "Should apply context to predicate/constraint", function () {
                expect( name ).to.be( "Rose" );
            } );
        } );
    } );
}());