var localBus = {
    
    subscriptions: {},

    wireTaps: [],

    publish: function(envelope) {
        envelope.timeStamp = new Date();
        _.each(this.wireTaps,function(tap) {
            tap({
                    exchange:   envelope.exchange,
                    topic:      envelope.topic,
                    data:       envelope.data,
                    timeStamp:  envelope.timeStamp
                });
        });

        _.each(this.subscriptions[envelope.exchange], function(topic) {
            _.each(topic, function(binding){
                if(postal.configuration.resolver.compare(binding.topic, envelope.topic)) {
                    if(_.all(binding.constraints, function(constraint) { return constraint(envelope.data); })) {
                        if(typeof binding.callback === 'function') {
                                binding.callback.apply(binding.context, [envelope.data]);
                                binding.onHandled();
                        }
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

        if(!this.subscriptions[config.exchange]) {
            this.subscriptions[config.exchange] = {};
        }

        if(!this.subscriptions[config.exchange][config.topic]) {
            this.subscriptions[config.exchange][config.topic] = [config];
        }
        else {
            idx = this.subscriptions[config.exchange][config.topic].length - 1;
            if(!_.any(this.subscriptions[config.exchange][config.topic], function(cfg) { return cfg === config; })) {
                for(; idx >= 0; idx--) {
                    if(this.subscriptions[config.exchange][config.topic][idx].priority <= config.priority) {
                        this.subscriptions[config.exchange][config.topic].splice(idx + 1, 0, config);
                        found = true;
                        break;
                    }
                }
                if(!found) {
                    this.subscriptions[config.exchange][config.topic].unshift(config);
                }
                console.log("SUBSCRIBE: " + JSON.stringify(config));
            }
        }

        return _.bind(function() { this.unsubscribe(config); }, this);
    },

    unsubscribe: function(config) {
        if(this.subscriptions[config.exchange][config.topic]) {
            var len = this.subscriptions[config.exchange][config.topic].length,
                idx = 0;
            for ( ; idx < len; idx++ ) {
                if (this.subscriptions[config.exchange][config.topic][idx] === config) {
                    this.subscriptions[config.exchange][config.topic].splice( idx, 1 );
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