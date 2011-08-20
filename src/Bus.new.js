var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    NO_OP = function() { };

var bus = {
    subscriptions: {}  
};

var postal = {
    exchange: function(exchange) {
        return new ChannelDefinition(exchange);
    },

    topic: function(topic) {
        return new ChannelDefinition(undefined, topic);
    },

    publish: function(config) {
        console.log("PUBLISH: " + JSON.stringify(config));
    },

    subscribe: function(config) {
        console.log("SUBSCRIBE: " + JSON.stringify(config));

        var idx, found;
        if(config.disposeAfter && config.disposeAfter > 0) {
            config.onHandled = function() {
                config.onHandled();
                _.after(config.disposeAfter, _.bind(function() { this.unsubscribe(config); }, this));
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
            }
        }

        return _.bind(function() { this.unsubscribe(config); }, this);
    },

    unsubscribe: function(config) {
        console.log("UNSUBSCRIBE: " + JSON.stringify(config));
        if(bus.subscriptions[config.exchange][config.topic]) {
            var len = bus.subscriptions[config.exchange][config.topic].length,
                idx = 0;
            for ( ; idx < len; idx++ ) {
                if (bus.subscriptions[config.exchange][config.topic][idx] === config) {
                    bus.subscriptions[config.exchange][config.topic].splice( idx, 1 );
                    break;
                }
            }
        }
    },
    
    addWireTap: function(callback) {
        console.log("WIRETAP: " + JSON.stringify(callback));
    }
};

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

    withPriority: function(priority) {
        if(_.isNaN(priority)) {
            throw "Priority must be a number";
        }
        this.configuration.priority = priority;
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