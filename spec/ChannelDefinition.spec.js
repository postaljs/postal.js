describe( "ChannelDefinition", function () {
	describe( "When initializing a channel definition", function () {
		var chDef = new ChannelDefinition( "TestChannel" );
		it( "should set channel to TestChannel", function () {
			expect( chDef.channel ).to.be( "TestChannel" );
		} );
	} );
	describe( "When calling subscribe", function () {
		var ch = new ChannelDefinition( "TestChannel" ),
			sub = ch.subscribe( "TestTopic", function () {
			} );
		it( "subscription should be instance of SubscriptionDefinition", function () {
			expect( sub instanceof SubscriptionDefinition ).to.be.ok();
		} );
	} );
} );