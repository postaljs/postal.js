describe( "ChannelDefinition", function () {
	describe( "When initializing a channel definition", function () {
		var chDef = new ChannelDefinition( "TestChannel", "TestTopic" );
		it( "should set channel to TestChannel", function () {
			expect( chDef.channel ).to.be( "TestChannel" );
		} );
		it( "should set topic to TestTopic", function () {
			expect( chDef._topic ).to.be( "TestTopic" );
		} );
	} );
	describe( "When calling subscribe", function () {
		var ch = new ChannelDefinition( "TestChannel", "TestTopic" ),
			sub = ch.subscribe( function () {
			} );
		it( "subscription should be instance of SubscriptionDefinition", function () {
			expect( sub instanceof SubscriptionDefinition ).to.be.ok();
		} );
	} );
	describe( "When calling topic", function () {
		var ch = new ChannelDefinition( "TestChannel", "TestTopic" ),
			ch2 = ch.topic( "TestTopic2" );
		it( "new channel should be of type ChannelDefinition", function () {
			expect( ch2 instanceof ChannelDefinition ).to.be.ok();
		} );
		it( "new channel should have topic of TestTopic2", function () {
			expect( ch2._topic ).to.be( "TestTopic2" );
		} );
	} );
} );