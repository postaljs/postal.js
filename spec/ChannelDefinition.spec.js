QUnit.specify( "postal.js", function () {
	describe( "ChannelDefinition", function () {
		describe( "When initializing a channel definition", function () {
			var chDef = new ChannelDefinition( "TestChannel", "TestTopic" );
			it( "should set channel to TestChannel", function () {
				assert( chDef.channel ).equals( "TestChannel" );
			} );
			it( "should set topic to TestTopic", function () {
				assert( chDef._topic ).equals( "TestTopic" );
			} );
		} );
		describe( "When calling subscribe", function () {
			var ch = new ChannelDefinition( "TestChannel", "TestTopic" ),
				sub = ch.subscribe( function () {
				} );
			it( "subscription should be instance of SubscriptionDefinition", function () {
				assert( sub instanceof SubscriptionDefinition ).isTrue();
			} );
		} );
		describe( "When calling topic", function () {
			var ch = new ChannelDefinition( "TestChannel", "TestTopic" ),
				ch2 = ch.topic( "TestTopic2" );
			it( "new channel should be of type ChannelDefinition", function () {
				assert( ch2 instanceof ChannelDefinition ).isTrue();
			} );
			it( "new channel should have topic of TestTopic2", function () {
				assert( ch2._topic ).equals( "TestTopic2" );
			} );
		} );
	} );
} );