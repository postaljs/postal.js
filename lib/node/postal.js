var _ = require('underscore');
/*
    postal.js
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.4.0
*/

var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    SYSTEM_EXCHANGE = "postal",
    NO_OP = function() { };

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

var ChannelDefinition = function(exchange, topic) {
    this.exchange = exchange;
    this.topic = topic;
};

ChannelDefinition.prototype = {
    subscribe: function(callback) {
        var subscription = new SubscriptionDefinition(this.exchange, this.topic, callback);
        postal.configuration.bus.subscribe(subscription);
        return subscription;
    },

    publish: function(data, envelope) {
        var env = envelope || {};
	    env.exchange = this.exchange;
	    env.timeStamp = new Date();
	    env.topic = this.topic;
        postal.configuration.bus.publish(env, data);
    }
};

var SubscriptionDefinition = function(exchange, topic, callback) {
    this.exchange = exchange;
    this.topic = topic;
    this.callback = callback;
    this.priority = DEFAULT_PRIORITY;
    this.constraints = new Array(0);
    this.maxCalls = DEFAULT_DISPOSEAFTER;
    this.onHandled = NO_OP;
    this.context = null;

    postal.publish({
		    exchange: SYSTEM_EXCHANGE,
		    topic: "subscription.created"
	    },
        {
            event: "subscription.created",
            exchange: exchange,
            topic: topic
        });
};

SubscriptionDefinition.prototype = {
    unsubscribe: function() {
        postal.configuration.bus.unsubscribe(this);
        postal.publish({
		        exchange: SYSTEM_EXCHANGE,
	            topic: "subscription.removed"
            },
            {
                event: "subscription.removed",
                exchange: this.exchange,
                topic: this.topic
            });
    },

    defer: function() {
        var fn = this.callback;
        this.callback = function(data) {
            setTimeout(fn,0,data);
        };
        return this;
    },

    disposeAfter: function(maxCalls) {
        if(_.isNaN(maxCalls) || maxCalls <= 0) {
            throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
        }

        var fn = this.onHandled;
        var dispose = _.after(maxCalls, _.bind(function() {
                this.unsubscribe(this);
            }, this));

        this.onHandled = function() {
            fn.apply(this.context, arguments);
            dispose();
        };
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
        this.onHandled = callback;
        return this;
    },

    withConstraint: function(predicate) {
        if(! _.isFunction(predicate)) {
            throw "Predicate constraint must be a function";
        }
        this.constraints.push(predicate);
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
        this.context = context;
        return this;
    },

    withDebounce: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = _.debounce(fn, milliseconds);
        return this;
    },

    withDelay: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = function(data) {
            setTimeout(fn, milliseconds, data);
        };
        return this;
    },

    withPriority: function(priority) {
        if(_.isNaN(priority)) {
            throw "Priority must be a number";
        }
        this.priority = priority;
        return this;
    },

    withThrottle: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = _.throttle(fn, milliseconds);
        return this;
    }
};

var bindingsResolver = {
    cache: { },

    compare: function(binding, topic) {
        if(this.cache[topic] && this.cache[topic][binding]) {
            return true;
        }
	    //  binding.replace(/\./g,"\\.")             // escape actual periods
	    //         .replace(/\*/g, ".*")             // asterisks match any value
	    //         .replace(/#/g, "[A-Z,a-z,0-9]*"); // hash matches any alpha-numeric 'word'
        var rgx = new RegExp("^" + binding.replace(/\./g,"\\.").replace(/\*/g, ".*").replace(/#/g, "[A-Z,a-z,0-9]*") + "$"),
            result = rgx.test(topic);
        if(result) {
            if(!this.cache[topic]) {
                this.cache[topic] = {};
            }
            this.cache[topic][binding] = true;
        }
        return result;
    }
};

var localBus = {

	subscriptions: {},

	wireTaps: new Array(0),

	publish: function(envelope, data) {
		_.each(this.wireTaps,function(tap) {
			tap(envelope, data);
		});

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
		var idx, found, fn, exch = this.subscriptions[subDef.exchange], subs;

		if(!exch) {
			exch = this.subscriptions[subDef.exchange] = {};
		}
		subs = this.subscriptions[subDef.exchange][subDef.topic]
		if(!subs) {
			subs = this.subscriptions[subDef.exchange][subDef.topic] = new Array(0);
		}

		idx = subs.length - 1;
		//if(!_.any(subs, function(cfg) { return cfg === subDef; })) {
			for(; idx >= 0; idx--) {
				if(subs[idx].priority <= subDef.priority) {
					subs.splice(idx + 1, 0, subDef);
					found = true;
					break;
				}
			}
			if(!found) {
				subs.unshift(subDef);
			}
		//}
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
		var self = this;
		self.wireTaps.push(callback);
		return function() {
			var idx = self.wireTaps.indexOf(callback);
			if(idx !== -1) {
				self.wireTaps.splice(idx,1);
			}
		};
	}
};

var publishPicker = {
	"2" : function(envelope, payload) {
		if(!envelope.exchange) {
			envelope.exchange = DEFAULT_EXCHANGE;
		}
		postal.configuration.bus.publish(envelope, payload);
	},
	"3" : function(exchange, topic, payload) {
		postal.configuration.bus.publish({ exchange: exchange, topic: topic }, payload);
	}
};

var postal = {
	configuration: {
		bus: localBus,
		resolver: bindingsResolver
	},

	channel: function(options) {
		var exch = options.exchange || DEFAULT_EXCHANGE,
			tpc = options.topic;
		return new ChannelDefinition(exch, tpc);
	},

	subscribe: function(options) {
		var callback = options.callback,
			topic = options.topic,
			exchange = options.exchange || DEFAULT_EXCHANGE;
		return new ChannelDefinition(exchange, topic).subscribe(callback);
	},

	publish: function() {
		var len = arguments.length;
		if(publishPicker[len]) {
			publishPicker[len].apply(this, arguments);
		}
	},

	addWireTap: function(callback) {
		return this.configuration.bus.addWireTap(callback);
	},

	bindExchanges: function(sources, destinations) {
		var subscriptions;
		if(!_.isArray(sources)) {
			sources = [sources];
		}
		if(!_.isArray(destinations)) {
			destinations = [destinations];
		}
		subscriptions = new Array(sources.length * destinations.length);
		_.each(sources, function(source){
			var sourceTopic = source.topic || "*";
			_.each(destinations, function(destination) {
				var destExchange = destination.exchange || DEFAULT_EXCHANGE;
				subscriptions.push(
					postal.subscribe({
							exchange: source.exchange || DEFAULT_EXCHANGE,
							topic: source.topic || "*",
							callback : function(msg, env) {
								var newEnv = env;
								newEnv.topic = _.isFunction(destination.topic) ? destination.topic(env.topic) : destination.topic || env.topic;
								newEnv.exchange = destExchange;
								postal.publish(newEnv, msg);
							}
					})
				);
			});
		});
		return subscriptions;
	}
};

module.exports = postal;