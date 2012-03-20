/*
    postal.js
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.6.0
*/

var _ = require('underscore');

var DEFAULT_CHANNEL = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    SYSTEM_CHANNEL = "postal",
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

var ChannelDefinition = function(channelName, defaultTopic) {
    this.channel = channelName || DEFAULT_CHANNEL;
    this.topic = defaultTopic || "";
};

ChannelDefinition.prototype = {
    subscribe: function() {
        var len = arguments.length;
	    if(len === 1) {
		    return new SubscriptionDefinition(this.channel, this.topic, arguments[0]);
	    }
	    else if (len === 2) {
		    return new SubscriptionDefinition(this.channel, arguments[0], arguments[1]);
	    }
    },

    publish: function(data, envelope) {
	    var env = envelope || {};
	    env.channel = this.channel;
	    env.timeStamp = new Date();
	    env.topic = env.topic || this.topic;
        postal.configuration.bus.publish(data, env);
    }
};

var SubscriptionDefinition = function(channel, topic, callback) {
	this.channel = channel;
	this.topic = topic;
	this.callback = callback;
	this.priority = DEFAULT_PRIORITY;
	this.constraints = new Array(0);
	this.maxCalls = DEFAULT_DISPOSEAFTER;
	this.onHandled = NO_OP;
	this.context = null;
	postal.publish({
			event: "subscription.created",
			channel: channel,
			topic: topic
		},{
		channel: SYSTEM_CHANNEL,
		topic: "subscription.created"
	});

	postal.configuration.bus.subscribe(this);

};

SubscriptionDefinition.prototype = {
	unsubscribe: function() {
		postal.configuration.bus.unsubscribe(this);
		postal.publish({
				event: "subscription.removed",
				channel: this.channel,
				topic: this.topic
			},{
			channel: SYSTEM_CHANNEL,
			topic: "subscription.removed"
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

	publish: function(data, envelope) {
		_.each(this.wireTaps,function(tap) {
			tap(data, envelope);
		});

		_.each(this.subscriptions[envelope.channel], function(topic) {
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
		var idx, found, fn, channel = this.subscriptions[subDef.channel], subs;

		if(!channel) {
			channel = this.subscriptions[subDef.channel] = {};
		}
		subs = this.subscriptions[subDef.channel][subDef.topic];
		if(!subs) {
			subs = this.subscriptions[subDef.channel][subDef.topic] = new Array(0);
		}

		idx = subs.length - 1;
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
		return subDef;
	},

	unsubscribe: function(config) {
		if(this.subscriptions[config.channel][config.topic]) {
			var len = this.subscriptions[config.channel][config.topic].length,
				idx = 0;
			for ( ; idx < len; idx++ ) {
				if (this.subscriptions[config.channel][config.topic][idx] === config) {
					this.subscriptions[config.channel][config.topic].splice( idx, 1 );
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
	"2" : function(data, envelope) {
		if(!envelope.channel) {
			envelope.channel = DEFAULT_CHANNEL;
		}
		postal.configuration.bus.publish(data, envelope);
	},
	"3" : function(channel, topic, payload) {
		postal.configuration.bus.publish(payload, { channel: channel, topic: topic });
	}
};

// save some setup time, albeit tiny
localBus.subscriptions[SYSTEM_CHANNEL] = {};

var postal = {
	configuration: {
		bus: localBus,
		resolver: bindingsResolver
	},

	channel: function(options) {
		var channel, tpc;
		tpc = (Object.prototype.toString.call(options) === "[object String]") ? options : options.topic;
		channel = options.channel || DEFAULT_CHANNEL;
		return new ChannelDefinition(channel, tpc);
	},

	subscribe: function(options) {
		var callback = options.callback,
			topic = options.topic,
			channel = options.channel || DEFAULT_CHANNEL;
		return new SubscriptionDefinition(channel, topic, callback);
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

	linkChannels: function(sources, destinations) {
		var result = [];
		if(!_.isArray(sources)) {
			sources = [sources];
		}
		if(!_.isArray(destinations)) {
			destinations = [destinations];
		}
		_.each(sources, function(source){
			var sourceTopic = source.topic || "*";
			_.each(destinations, function(destination) {
				var destChannel = destination.channel || DEFAULT_CHANNEL;
				result.push(
					postal.subscribe({
						channel: source.channel || DEFAULT_CHANNEL,
						topic: source.topic || "*",
						callback : function(msg, env) {
							var newEnv = env;
							newEnv.topic = _.isFunction(destination.topic) ? destination.topic(env.topic) : destination.topic || env.topic;
							newEnv.channel = destChannel;
							postal.publish(msg, newEnv);
						}
					})
				);
			});
		});
		return result;
	}
};


module.exports = postal;