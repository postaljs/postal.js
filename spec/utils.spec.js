/* global describe, postal, it, after, before, expect */
(function() {
    var postal = typeof window === "undefined" ? require("../lib/postal.js")() : window.postal;
    var expect = typeof window === "undefined" ? require("expect.js") : window.expect;
    var _ = typeof window === "undefined" ? require("underscore") : window._;
    var NO_OP = function() {};
    var subscription;
    var sub;

    describe("postal.utils", function() {
        describe( "When calling postal.utils.getSubscribersFor", function () {
            var subs = [], i;
            before( function () {
                i = 10;
                var ch1 = postal.channel( "MyChannel" ),
                    ch2 = postal.channel( "MyChannel2" );
                while ( i ) {
                    subs.push( ch1.subscribe( "MyTopic",  NO_OP) );
                    subs.push( ch2.subscribe( "MyTopic2", NO_OP) );
                    i--;
                }
            } );
            after( function () {
                subs = [];
                postal.utils.reset();
            } );
            it( "should return expected results for MyChannel/MyTopic", function () {
                var results = postal.utils.getSubscribersFor( { channel : "MyChannel", topic : "MyTopic" } );
                expect( results.length ).to.be( 10 );
            } );
            it( "should return expected results for MyChannel2/MyTopic2", function () {
                var results = postal.utils.getSubscribersFor( { channel : "MyChannel2", topic : "MyTopic2" } );
                expect( results.length ).to.be( 10 );
            } );
        } );
        describe( "When calling postal.utils.reset", function () {
            var resolver;
            before( function () {
                postal.utils.reset();
                subscription = postal.channel( "MyChannel" ).subscribe( "MyTopic", function () {});
                postal.channel( "MyChannel" ).publish( "MyTopic", "Oh Hai!" );
                sub = postal.configuration.bus.subscriptions.MyChannel.MyTopic[0];
                resolver = postal.configuration.resolver.cache.MyTopic;
                postal.utils.reset();
            } );
            after( function () {
            } );
            it( "should have created a subscription definition", function () {
                expect( sub.channel ).to.be( "MyChannel" );
                expect( sub.topic ).to.be( "MyTopic" );
                expect( sub.constraints.length ).to.be( 0 );
                expect( sub.context ).to.be( null );
            } );
            it( "should have created a resolver cache entry", function () {
                expect( _.isEmpty( resolver ) ).to.not.be.ok()
                expect( resolver.MyTopic ).to.be.ok();
            } );
            it( "subscriptions cache should now be empty", function () {
                expect( _.isEmpty( postal.configuration.bus.subscriptions ) ).to.be.ok();
            } );
            it( "resolver cache should now be empty", function () {
                expect( _.isEmpty( postal.configuration.resolver.cache ) ).to.be.ok();
            } );
        } );
    });
}());