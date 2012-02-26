var localBus = {

    subscriptions: {},

    wireTaps: [],

    publish: function(data, envelope) {
        this.notifyTaps(data, envelope);

        _.each(this.subscriptions[envelope.exchange], function(topic) {
            _.each(topic, function(binding){
                if(postal.configuration.resolver.compare(binding.topic, envelope.topic)) {
                    if(_.all(binding.constraints, function(constraint) { return constraint(data); })) {
                        if(typeof binding.callback === 'function') {
                            binding.callback.apply(binding.context, [data, envelope]);
                            binding.onHandled();
                        }
                    }
                }
            });
        });
    },

    subscribe: function(subDef) {
        var idx, found, fn;

        if(!this.subscriptions[subDef.exchange]) {
            this.subscriptions[subDef.exchange] = {};
        }
        if(!this.subscriptions[subDef.exchange][subDef.topic]) {
            this.subscriptions[subDef.exchange][subDef.topic] = [];
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

    notifyTaps: function(data, envelope) {
        _.each(this.wireTaps,function(tap) {
            tap(data, envelope);
        });
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
