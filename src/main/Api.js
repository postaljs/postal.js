var postal = {
    configuration: {
        bus: localBus,
        resolver: bindingsResolver
    },

    channel: function(exchange, topic) {
        var exch = arguments.length === 2 ? exchange : DEFAULT_EXCHANGE,
            tpc  = arguments.length === 2 ? topic : exchange;
        return new ChannelDefinition(exch, tpc);
    },

    subscribe: function(exchange, topic, callback) {
        var exch = arguments.length === 3 ? exchange : DEFAULT_EXCHANGE,
            tpc  = arguments.length === 3 ? topic : exchange,
            callbk  = arguments.length === 3 ? callback : topic;
        var channel = this.channel(exch, tpc);
        return channel.subscribe(callbk);
    },

    publish: function(exchange, topic, payload) {
        var exch = arguments.length === 3 ? exchange : DEFAULT_EXCHANGE,
            tpc  = arguments.length === 3 ? topic : exchange,
            msg  = arguments.length === 3 ? payload : topic;
        var channel = this.channel(exch, tpc);
        channel.publish(msg);
    },

    addWireTap: function(callback) {
        this.configuration.bus.addWireTap(callback);
    }
};
