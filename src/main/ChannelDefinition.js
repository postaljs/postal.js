var ChannelDefinition = function(exchange, topic) {
    this.exchange = exchange;
    this.topic = topic;
};

ChannelDefinition.prototype = {
    subscribe: function(callback) {
        var subscription = new SubscriptionDefinition(this.exchange, this.topic, callback);
        postal.configuration.bus.subscribe(subscription);
        return subscription;
    },

    publish: function(data, envelope) {
        var env = envelope || {};
	    env.exchange = this.exchange;
	    env.timeStamp = new Date();
	    env.topic = this.topic;
        postal.configuration.bus.publish(env, data);
    }
};
