var ChannelDefinition = function ( channelName ) {
	this.channel = channelName || DEFAULT_CHANNEL;
};

ChannelDefinition.prototype = {
	subscribe : function () {
    return arguments.length === 1 ?
      new SubscriptionDefinition( this.channel, arguments[0].topic, arguments[0].callback ) :
      new SubscriptionDefinition( this.channel, arguments[0], arguments[1] );
	},

	publish : function () {
    var envelope = arguments.length === 1 ? arguments[0] : { topic: arguments[0], data: arguments[1] };
    envelope.channel = this.channel;
		postal.configuration.bus.publish( envelope );
		return envelope;
	}
};
