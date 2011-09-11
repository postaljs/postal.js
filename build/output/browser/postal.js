/*
    postal.js
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.1.0
*/

(function(global, undefined) {

var DistinctPredicate = function() {
    var previous;
    return function(data) {
        var eq = false;
        if(_.isString(data)) {
            eq = data === previous;
            previous = data;
        }
        else {
            eq = _.isEqual(data, previous);
            previous = _.clone(data);
        }
        return !eq;
    };
};
var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    NO_OP = function() { };

var ChannelDefinition = function(exchange, topic) {
    this.configuration = {
        exchange: exchange || DEFAULT_EXCHANGE,
        topic: topic || "",
        callback: NO_OP,
        priority: DEFAULT_PRIORITY,
        constraints: [],
        disposeAfter: DEFAULT_DISPOSEAFTER,
        onHandled: NO_OP,
        context: null,
        modifiers: []
    };
} ;

ChannelDefinition.prototype = {
    exchange: function(exchange) {
        this.configuration.exchange = exchange;
        return this;
    },

    topic: function(topic) {
        this.configuration.topic = topic;
        return this;
    },

    defer: function() {
        this.configuration.modifiers.push({type: "defer"});
        return this;
    },

    disposeAfter: function(receiveCount) {
        if(_.isNaN(receiveCount)) {
            throw "The value provided to disposeAfter (receiveCount) must be a number";
        }
        this.configuration.disposeAfter = receiveCount;
        return this;
    },

    ignoreDuplicates: function() {
        this.withConstraint(new DistinctPredicate());
        return this;
    },

    whenHandledThenExecute: function(callback) {
        if(! _.isFunction(callback)) {
            throw "Value provided to 'whenHandledThenExecute' must be a function";
        }
        this.configuration.onHandled = callback;
        return this;
    },

    withConstraint: function(predicate) {
        if(! _.isFunction(predicate)) {
            throw "Predicate constraint must be a function";
        }
        this.configuration.constraints.push(predicate);
        return this;
    },

    withConstraints: function(predicates) {
        var self = this;
        if(_.isArray(predicates)) {
            _.each(predicates, function(predicate) { self.withConstraint(predicate); } );
        }
        return self;
    },

    withContext: function(context) {
        this.configuration.context = context;
        return this;
    },

    withDebounce: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.modifiers.push({type: "debounce", milliseconds: milliseconds});
        return this;
    },

    withDelay: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.modifiers.push({type: "delay", milliseconds: milliseconds});
        return this;
    },

    withPriority: function(priority) {
        if(_.isNaN(priority)) {
            throw "Priority must be a number";
        }
        this.configuration.priority = priority;
        return this;
    },

    withThrottle: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.modifiers.push({type: "throttle", milliseconds: milliseconds});
        return this;
    },

    subscribe: function(callback) {
        this.configuration.callback = callback || NO_OP;
        return postal.subscribe(this.configuration);
    },

    publish: function(data) {
        postal.publish({
                        exchange: this.configuration.exchange,
                        data: data,
                        topic: this.configuration.topic
                       });
    }
};
var bindingsResolver = {
    cache: { },
    
    compare: function(binding, topic) {
        var rgx = new RegExp("^" + this.regexify(binding) + "$"); // match from start to end of string
        return rgx.test(topic);
    },
    
    regexify: function(binding) {
        return binding.replace(/\./g,"\\.") // escape actual periods
                      .replace(/\*/g, ".*") // asterisks match any value
                      .replace(/#/g, "[A-Z,a-z,0-9]*"); // hash matches any alpha-numeric 'word'
    }
};
var wrapWithDelay = function(callback, config) {
        return function(data) {
            setTimeout(callback, config.milliseconds, data);
        };
    },
    wrapWithDefer = function(callback) {
        return function(data) {
            setTimeout(callback,0,data);
        }
    },
    wrapWithThrottle = function(callback, config) {
        return _.throttle(callback, config.throttle);
    },
    wrapWithDebounce = function(callback, config) {
        return _.debounce(callback, config.debounce);
    };

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
        var idx, found, fn;
        if(config.disposeAfter && config.disposeAfter > 0) {
            fn = config.onHandled,
                dispose = _.after(config.disposeAfter, _.bind(function() {
                    this.unsubscribe(config);
                }, this));
            
            config.onHandled = function() {
                fn.apply(config.context, arguments);
                dispose();
            }
        }

        _.each(config.modifiers, function(modifier) {
            fn = config.callback;
            switch(modifier.type) {
                case 'delay':
                    config.callback = wrapWithDelay(fn, modifier);
                break;
                case 'defer':
                    config.callback = wrapWithDefer(fn);
                break;
                case 'throttle':
                    config.callback = wrapWithThrottle(fn,modifier);
                break;
                case 'debounce':
                    config.callback = wrapWithDebounce(fn, modifier);
                break;
            }
        });

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

global.postal = postal;

})(window);