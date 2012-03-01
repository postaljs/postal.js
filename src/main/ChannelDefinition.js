var ChannelDefinition = function(exchange, topic) {
    this.exchange = exchange;
    this.topic = topic;
};

ChannelDefinition.prototype = {
    subscribe: function(callback) {
	    return postal.configuration.bus.subscribe(new SubscriptionDefinition(this.exchange, this.topic, callback));
    },

    publish: function(data, envelope) {
        var env = envelope || {};
	    env.exchange = this.exchange;
	    env.timeStamp = new Date();
	    env.topic = this.topic;
        postal.configuration.bus.publish(env, data);
    }
};
