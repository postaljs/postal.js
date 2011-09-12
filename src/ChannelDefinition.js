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

    publish: function(data) {
        postal.configuration.bus.publish({
            exchange: this.exchange,
            topic: this.topic,
            data: data,
            timeStamp: new Date()
        })
    }
};
