/* global _postal, SubscriptionDefinition */

var ChannelDefinition = function( channelName, bus ) {
	this.bus = bus;
	this.channel = channelName || _postal.configuration.DEFAULT_CHANNEL;
};

ChannelDefinition.prototype.subscribe = function() {
	return this.bus.subscribe( {
		channel: this.channel,
		topic: ( arguments.length === 1 ? arguments[ 0 ].topic : arguments[ 0 ] ),
		callback: ( arguments.length === 1 ? arguments[ 0 ].callback : arguments[ 1 ] )
	} );
};

ChannelDefinition.prototype.publish = function() {
	var envelope = arguments.length === 1 ?
		( Object.prototype.toString.call( arguments[ 0 ] ) === "[object String]" ? {
			topic: arguments[ 0 ]
		} :
		arguments[ 0 ] ) : {
			topic: arguments[ 0 ],
			data: arguments[ 1 ]
		};
	envelope.channel = this.channel;
	this.bus.publish( envelope );
};
