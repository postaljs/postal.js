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
    this._topic = defaultTopic || "";
};

ChannelDefinition.prototype = {
    subscribe: function() {
        var len = arguments.length;
	    if(len === 1) {
		    return new SubscriptionDefinition(this.channel, this._topic, arguments[0]);
	    }
	    else if (len === 2) {
		    return new SubscriptionDefinition(this.channel, arguments[0], arguments[1]);
	    }
    },

    publish: function(obj) {
	    var envelope = {
		    channel: this.channel,
		    topic: this._topic,
		    data: obj
	    };
	    // If this is an envelope....
	    if( obj.topic && obj.data ) {
		    envelope = obj;
		    envelope.channel = envelope.channel || this.channel;
	    }
	    envelope.timeStamp = new Date();
		postal.configuration.bus.publish(envelope);
    },

	topic: function(topic) {
		if(topic === this._topic) {
			return this;
		}
		return new ChannelDefinition(this.channel, topic);
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
	postal.configuration.bus.publish({
			channel: SYSTEM_CHANNEL,
			topic: "subscription.created",
			timeStamp: new Date(),
			data: {
				event: "subscription.created",
				channel: channel,
				topic: topic
			}
	});

	postal.configuration.bus.subscribe(this);

};

SubscriptionDefinition.prototype = {
	unsubscribe: function() {
		postal.configuration.bus.unsubscribe(this);
		postal.configuration.bus.publish({
			channel: SYSTEM_CHANNEL,
			topic: "subscription.removed",
			timeStamp: new Date(),
			data: {
				event: "subscription.removed",
				channel: this.channel,
				topic: this.topic
			}
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
	},

	subscribe: function(callbacl) {
		this.callback = callback;
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

	publish: function(envelope) {
		_.each(this.wireTaps,function(tap) {
			tap(envelope.data, envelope);
		});

		_.each(this.subscriptions[envelope.channel], function(topic) {
			_.each(topic, function(subDef){
				if(postal.configuration.resolver.compare(subDef.topic, envelope.topic)) {
					if(_.all(subDef.constraints, function(constraint) { return constraint(envelope.data); })) {
						if(typeof subDef.callback === 'function') {
							subDef.callback.apply(subDef.context, [envelope.data, envelope]);
							subDef.onHandled();
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
	"1" : function(envelope) {
		if(!envelope) {
			throw new Error("publishing from the 'global' postal.publish call requires a valid envelope.");
		}
		envelope.channel = envelope.channel || DEFAULT_CHANNEL;
		envelope.timeStamp = new Date();
		postal.configuration.bus.publish(envelope);
	},
	"2" : function(topic, data) {
		postal.configuration.bus.publish({ channel: DEFAULT_CHANNEL, topic: topic, timeStamp: new Date(), data: data });
	},
	"3" : function(channel, topic, data) {
		postal.configuration.bus.publish({ channel: channel, topic: topic, timeStamp: new Date(), data: data });
	}
};

// save some setup time, albeit tiny
localBus.subscriptions[SYSTEM_CHANNEL] = {};

var postal = {
	configuration: {
		bus: localBus,
		resolver: bindingsResolver
	},

	channel: function() {
		var len = arguments.length,
			channel = arguments[0],
			tpc = arguments[1];
		if(len === 1) {
			if(Object.prototype.toString.call(channel) === "[object String]") {
				channel = DEFAULT_CHANNEL;
				tpc = arguments[0];
			}
			else {
				channel = arguments[0].channel || DEFAULT_CHANNEL;
				tpc = arguments[0].topic;
			}
		}
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
						callback : function(data, env) {
							var newEnv = env;
							newEnv.topic = _.isFunction(destination.topic) ? destination.topic(env.topic) : destination.topic || env.topic;
							newEnv.channel = destChannel;
							newEnv.data = data;
							postal.publish(newEnv);
						}
					})
				);
			});
		});
		return result;
	}
};


module.exports = postal;