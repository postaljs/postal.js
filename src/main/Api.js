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
		var channel = options.channel || DEFAULT_CHANNEL,
			tpc = options.topic;
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
