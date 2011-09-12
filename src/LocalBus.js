var localBus = {

    subscriptions: {},

    wireTaps: [],

    publish: function(envelope) {
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

    subscribe: function(subDef) {
        var idx, found, fn;
        if(subDef.maxCalls) {
            fn = subDef.onHandled;
            var dispose = _.after(subDef.maxCalls, _.bind(function() {
                    this.unsubscribe(subDef);
                }, this));

            subDef.onHandled = function() {
                fn.apply(subDef.context, arguments);
                dispose();
            }
        }

        idx = this.subscriptions[subDef.exchange][subDef.topic].length - 1;
        if(!_.any(this.subscriptions[subDef.exchange][subDef.topic], function(cfg) { return cfg === subDef; })) {
            for(; idx >= 0; idx--) {
                if(this.subscriptions[subDef.exchange][subDef.topic][idx].priority <= subDef.priority) {
                    this.subscriptions[subDef.exchange][subDef.topic].splice(idx + 1, 0, subDef);
                    found = true;
                    break;
                }
            }
            if(!found) {
                this.subscriptions[subDef.exchange][subDef.topic].unshift(subDef);
            }
        }

        return _.bind(function() { this.unsubscribe(subDef); }, this);
    },

    unsubscribe: function(config) {
        if(this.subscriptions[config.exchange][config.topic]) {
            var len = this.subscriptions[config.exchange][config.topic].length,
                idx = 0;
            for ( ; idx < len; idx++ ) {
                if (this.subscriptions[config.exchange][config.topic][idx] === config) {
                    this.subscriptions[config.exchange][config.topic].splice( idx, 1 );
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
