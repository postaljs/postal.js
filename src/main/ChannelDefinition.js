var ChannelDefinition = function(channelName, defaultTopic) {
    this.channel = channelName;
    this.topic = defaultTopic || "";
};

ChannelDefinition.prototype = {
    subscribe: function(callback) {
	    return new SubscriptionDefinition(this.channel, this.topic, callback);
    },

    publish: function(data, envelope) {
	    var env = envelope || {};
	    env.channel = this.channel;
	    env.timeStamp = new Date();
	    env.topic = env.topic || this.topic;
        postal.configuration.bus.publish(env, data);
    }
};
