/* global postal, SubscriptionDefinition */
var ChannelDefinition = function ( channelName ) {
	this.channel = channelName || postal.configuration.DEFAULT_CHANNEL;
};

ChannelDefinition.prototype.subscribe = function () {
	return arguments.length === 1 ?
	       new SubscriptionDefinition( this.channel, arguments[0].topic, arguments[0].callback ) :
	       new SubscriptionDefinition( this.channel, arguments[0], arguments[1] );
};

ChannelDefinition.prototype.publish = function () {
	var envelope = arguments.length === 1 ?
	               ( Object.prototype.toString.call( arguments[0] ) === "[object String]" ?
	                { topic : arguments[0] } :
	                arguments[0] ) :
	               { topic : arguments[0], data : arguments[1] };
	envelope.channel = this.channel;
	return postal.configuration.bus.publish( envelope );
};