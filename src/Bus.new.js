var bus;
    
var localBus = {
    subscriptions: {},

    wireTaps: [],

    publish: function(envelope) {
        _.each(this.wireTaps,function(tap) {
            tap({
                    exchange:   envelope.exchange,
                    topic:      envelope.topic,
                    data:       envelope.data,
                    timeStamp:  new Date()
                });
        });


        _.each(this.subscriptions[envelope.exchange], function(topic) {
            _.each(topic, function(binding){
                if(postal.config.bindingsResolver.compare(binding.topic, envelope.topic)) {
                    if(typeof binding.callback === 'function') {
                            binding.callback.apply(binding.context, [envelope.data]);
                            binding.onHandled();
                    }  
                }
            });
        });
    },

    subscribe: function(config) {
        var idx, found;
        if(config.disposeAfter && config.disposeAfter > 0) {
            var fn = config.onHandled,
                dispose = _.after(config.disposeAfter, _.bind(function() {
                    this.unsubscribe(config);
                }, this));
            
            config.onHandled = function() {
                fn.apply(config.context, arguments);
                dispose();
            }
        }

        if(!bus.subscriptions[config.exchange]) {
            bus.subscriptions[config.exchange] = {};
        }

        if(!bus.subscriptions[config.exchange][config.topic]) {
            bus.subscriptions[config.exchange][config.topic] = [config];
        }
        else {
            idx = bus.subscriptions[config.exchange][config.topic].length - 1;
            if(!_.any(bus.subscriptions[config.exchange][config.topic], function(cfg) { return cfg === config; })) {
                for(; idx >= 0; idx--) {
                    if(bus.subscriptions[config.exchange][config.topic][idx].priority <= config.priority) {
                        bus.subscriptions[config.exchange][config.topic].splice(idx + 1, 0, config);
                        found = true;
                        break;
                    }
                }
                if(!found) {
                    bus.subscriptions[config.exchange][config.topic].unshift(config);
                }
                console.log("SUBSCRIBE: " + JSON.stringify(config));
            }
        }

        return _.bind(function() { this.unsubscribe(config); }, this);
    },

    unsubscribe: function(config) {
        if(bus.subscriptions[config.exchange][config.topic]) {
            var len = bus.subscriptions[config.exchange][config.topic].length,
                idx = 0;
            for ( ; idx < len; idx++ ) {
                if (bus.subscriptions[config.exchange][config.topic][idx] === config) {
                    bus.subscriptions[config.exchange][config.topic].splice( idx, 1 );
                    console.log("UNSUBSCRIBE: " + JSON.stringify(config));
                    break;
                }
            }
        }
    },

    addWireTap: function(callback) {
        this.wireTaps.push(callback);
        return function() {
            var idx = this.wireTaps.indexOf(callback);
            if(idx !== -1) {
                this.wireTaps.splice(idx,1);
            }
        };
    }
};

var postal = {
    
    config: {
        setBusBehavior: function(behavior) {
            bus = behavior;
        },
        
        bindingsResolver: bindingsResolver
    },

    exchange: function(exchange) {
        return new ChannelDefinition(exchange);
    },

    topic: function(topic) {
        return new ChannelDefinition(undefined, topic);
    },

    publish: function(config) {
        bus.publish(config);
    },

    subscribe: function(config) {
        return bus.subscribe(config);
    },

    unsubscribe: function(config) {
        bus.unsubscribe(config);
    },
    
    addWireTap: function(callback) {
        bus.addWireTap(callback);
    }
};

postal.config.setBusBehavior(localBus);