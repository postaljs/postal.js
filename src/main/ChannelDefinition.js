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
        var env = _.extend({
            exchange: this.exchange,
            timeStamp: new Date(),
            topic: this.topic
        }, envelope);
        postal.configuration.bus.publish(data, env);
    }
};
