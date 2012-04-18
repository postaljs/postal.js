var publishPicker = {
		"1" : function(envelope) {
			if(!envelope) {
				throw new Error("publishing from the 'global' postal.publish call requires a valid envelope.");
			}
			envelope.channel = envelope.channel || DEFAULT_CHANNEL;
			envelope.timeStamp = new Date();
			postal.configuration.bus.publish(envelope);
			return envelope;
		},
		"2" : function(topic, data) {
			var envelope = { channel: DEFAULT_CHANNEL, topic: topic, timeStamp: new Date(), data: data };
			postal.configuration.bus.publish( envelope );
			return envelope;
		},
		"3" : function(channel, topic, data) {
			var envelope = { channel: channel, topic: topic, timeStamp: new Date(), data: data };
			postal.configuration.bus.publish( envelope );
			return envelope;
		}
	},
	channelPicker = {
		"1" : function( chn ) {
			var channel = chn, topic, options = {};
			if( Object.prototype.toString.call( channel ) === "[object String]" ) {
				channel = DEFAULT_CHANNEL;
				topic   = chn;
			}
			else {
				channel = chn.channel || DEFAULT_CHANNEL;
				topic   = chn.topic;
				options = chn.options || options;
			}
			return new postal.channelTypes[ options.type || "LocalChannel" ]( channel, topic );
		},
		"2" : function( chn, tpc ) {
			var channel = chn, topic = tpc, options = {};
			if( Object.prototype.toString.call( tpc ) === "[object Object]" ) {
				channel = DEFAULT_CHANNEL;
				topic   = chn;
				options = tpc;
			}
			return new postal.channelTypes[ options.type || "LocalChannel" ]( channel, topic );
		},
		"3" : function( channel, topic, options ) {
			return new postal.channelTypes[ options.type || "LocalChannel" ]( channel, topic );
		}
	};

// save some setup time, albeit tiny
localBus.subscriptions[SYSTEM_CHANNEL] = {};

var postal = {
	configuration: {
		bus: localBus,
		resolver: bindingsResolver,
		DEFAULT_CHANNEL: DEFAULT_CHANNEL,
		DEFAULT_PRIORITY: DEFAULT_PRIORITY,
		DEFAULT_DISPOSEAFTER: DEFAULT_DISPOSEAFTER,
		SYSTEM_CHANNEL: SYSTEM_CHANNEL
	},

	channelTypes: {
		LocalChannel: ChannelDefinition
	},

	channel: function() {
		var len = arguments.length;
		if(channelPicker[len]) {
			return channelPicker[len].apply(this, arguments);
		}
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
			return publishPicker[len].apply(this, arguments);
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
	},

	reset: function() {
		// we check first in case a custom bus or resolver
		// doesn't expose subscriptions or a resolver cache
		if(postal.configuration.bus.subscriptions) {
			postal.configuration.bus.subscriptions = {};
		}
		if(postal.configuration.resolver.cache) {
			postal.configuration.resolver.cache = {};
		}
	}
};
