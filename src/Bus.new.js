var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    NO_OP = function() { },
    bus;

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
    
var localBus = {
    subscriptions: {},

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
        console.log("WIRETAP: " + JSON.stringify(callback));
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

var ChannelDefinition = function(exchange, topic) {
    this.configuration = {
        exchange: exchange || DEFAULT_EXCHANGE,
        topic: topic || "",
        callback: NO_OP,
        priority: DEFAULT_PRIORITY,
        constraints: [],
        disposeAfter: DEFAULT_DISPOSEAFTER,
        onHandled: NO_OP,
        context: null
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
        this.configuration.defer = true;
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
        if(_.isArray(predicates)) {
            _.each(predicates, function(predicate) { this.withConstraint(predicate); } );
        }
        return this;
    },

    withContext: function(context) {
        this.configuration.context = context;
        return this;
    },

    withDebounce: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.debounce = milliseconds;
        return this;
    },

    withDelay: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.delay = milliseconds;
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
        this.configuration.throttle = milliseconds;
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

var DistinctPredicate = function() {
    this.previous = undefined;
    return function(data) {
        var result = _.isEqual(data, this.previous);
        this.previous = data;
        return result;
    }
};

/*

    postal.exchange("myExchange")
          .topic("myTopic.mySubTopic")
          .ignoreDuplicates() // is this the best name?
          .withConstraint( function(data) { return data.firstName === "Jim"; })
          .subscribe(function() { });
*/