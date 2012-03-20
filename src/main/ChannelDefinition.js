var ChannelDefinition = function(channelName, defaultTopic) {
    this.channel = channelName || DEFAULT_CHANNEL;
    this.topic = defaultTopic || "";
};

ChannelDefinition.prototype = {
    subscribe: function() {
        var len = arguments.length;
	    if(len === 1) {
		    return new SubscriptionDefinition(this.channel, this.topic, arguments[0]);
	    }
	    else if (len === 2) {
		    return new SubscriptionDefinition(this.channel, arguments[0], arguments[1]);
	    }
    },

    publish: function(data, envelope) {
	    var env = (Object.prototype.toString.call(envelope) === "[object String]") ? { topic: envelope } : envelope || {};
	    env.channel = this.channel;
	    env.timeStamp = new Date();
	    env.topic = env.topic || this.topic;
        postal.configuration.bus.publish(data, env);
    }
};
