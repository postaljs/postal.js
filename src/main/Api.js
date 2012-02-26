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

    publish: function(exchange, topic, payload, envelopeOptions) {
        var parsedArgs = parsePublishArgs([].slice.call(arguments,0));
        var channel = this.channel(parsedArgs.envelope.exchange, parsedArgs.envelope.topic);
        channel.publish(parsedArgs.payload, parsedArgs.envelope);
    },

    addWireTap: function(callback) {
        return this.configuration.bus.addWireTap(callback);
    }
};
