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

    addWireTap: function(callback) {
        this.configuration.bus.addWireTap(callback);
    }
};
