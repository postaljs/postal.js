/* global _postal, SubscriptionDefinition, _config */

var ChannelDefinition = function( channelName, bus ) {
	this.bus = bus;
	this.channel = channelName || _config.DEFAULT_CHANNEL;
};

ChannelDefinition.prototype.subscribe = function() {
	return this.bus.subscribe( {
		channel: this.channel,
		topic: ( arguments.length === 1 ? arguments[ 0 ].topic : arguments[ 0 ] ),
		callback: ( arguments.length === 1 ? arguments[ 0 ].callback : arguments[ 1 ] )
	} );
};

ChannelDefinition.prototype.publish = function() {
	var envelope, callback;
	if ( arguments.length === 1 ) {
		envelope = Object.prototype.toString.call( arguments[ 0 ] ) === "[object String]" ? { topic: arguments[ 0 ] } : arguments[ 0 ];
		callback = arguments[ 1 ];
	} else {
		envelope = { topic: arguments[ 0 ], data: arguments[ 1 ] };
		callback = arguments[ 2 ];
	}
	envelope.channel = this.channel;
	this.bus.publish( envelope, callback );
};
