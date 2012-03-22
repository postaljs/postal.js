var ChannelDefinition = function(channelName, defaultTopic) {
	this.channel = channelName || DEFAULT_CHANNEL;
	this._topic = defaultTopic || "";
};

ChannelDefinition.prototype = {
	subscribe: function() {
		var len = arguments.length;
		if(len === 1) {
			return new SubscriptionDefinition(this.channel, this._topic, arguments[0]);
		}
		else if (len === 2) {
			return new SubscriptionDefinition(this.channel, arguments[0], arguments[1]);
		}
	},

	publish: function(obj) {
		var envelope = {
			channel: this.channel,
			topic: this._topic,
			data: obj
		};
		// If this is an envelope....
		if( obj.topic && obj.data ) {
			envelope = obj;
			envelope.channel = envelope.channel || this.channel;
		}
		envelope.timeStamp = new Date();
		postal.configuration.bus.publish(envelope);
	},

	topic: function(topic) {
		if(topic === this._topic) {
			return this;
		}
		return new ChannelDefinition(this.channel, topic);
	}
};
