var postal = {

    configuration: {
        bus: localBus,
        resolver: bindingsResolver
    },

    exchange: function(exchange) {
        return new ChannelDefinition(exchange);
    },

    topic: function(topic) {
        return new ChannelDefinition(undefined, topic);
    },

    publish: function(config) {
        this.configuration.bus.publish(config);
    },

    subscribe: function(config) {
        return this.configuration.bus.subscribe(config);
    },

    unsubscribe: function(config) {
        this.configuration.bus.unsubscribe(config);
    },

    addWireTap: function(callback) {
        this.configuration.bus.addWireTap(callback);
    }
};