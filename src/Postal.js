var postal = {
    configuration: {
        bus: localBus,
        resolver: bindingsResolver
    },

    createChannel: function(exchange, topic) {
        var exch = arguments.length === 2 ? exchange : DEFAULT_EXCHANGE,
            tpc  = arguments.length === 2 ? topic : exchange;
        if(!this.configuration.bus.subscriptions[exch]) {
            this.configuration.bus.subscriptions[exch] = {};
        }
        if(!this.configuration.bus.subscriptions[exch][tpc]) {
            this.configuration.bus.subscriptions[exch][tpc] = [];
        }
        return new ChannelDefinition(exch, tpc);
    },

    addWireTap: function(callback) {
        this.configuration.bus.addWireTap(callback);
    }
};
