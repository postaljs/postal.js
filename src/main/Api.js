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
		return new SubscriptionDefinition(exchange, topic, callback);
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
