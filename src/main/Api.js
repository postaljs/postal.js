var postal = {
	configuration: {
		bus: localBus,
		resolver: bindingsResolver
	},

	channel: function(exchange, topic) {
		var exch = arguments.length === 2 ? exchange : DEFAULT_EXCHANGE,
			tpc  = arguments.length === 2 ? topic : exchange;
		return new ChannelDefinition(exch, tpc);
	},

	subscribe: function(exchange, topic, callback) {
		var exch = arguments.length === 3 ? exchange : DEFAULT_EXCHANGE,
			tpc  = arguments.length === 3 ? topic : exchange,
			callbk  = arguments.length === 3 ? callback : topic;
		var channel = this.channel(exch, tpc);
		return channel.subscribe(callbk);
	},

	publish: function(exchange, topic, payload, envelopeOptions) {
		var parsedArgs = parsePublishArgs([].slice.call(arguments,0));
		var channel = this.channel(parsedArgs.envelope.exchange, parsedArgs.envelope.topic);
		channel.publish(parsedArgs.payload, parsedArgs.envelope);
	},

	addWireTap: function(callback) {
		return this.configuration.bus.addWireTap(callback);
	},

	bindExchanges: function(sources, destinations) {
		var subscriptions = [];
		if(!_.isArray(sources)) {
			sources = [sources];
		}
		if(!_.isArray(destinations)) {
			destinations = [destinations];
		}
		_.each(sources, function(source){
			var sourceTopic = source.topic || "*";
			console.log("SOURCE: " + source.exchange + " | " + sourceTopic);
			_.each(destinations, function(destination) {
				var destExchange = destination.exchange || DEFAULT_EXCHANGE;
				subscriptions.push(
					postal.subscribe(source.exchange || DEFAULT_EXCHANGE, source.topic || "*", function(msg, env) {
						var destTopic = _.isFunction(destination.topic) ? destination.topic(env.topic) : destination.topic || env.topic;
						console.log("DESTINATION: " + destExchange + " | " + destTopic);
						postal.publish(destExchange, destTopic, msg);
					})
				);
			});
		});
		return subscriptions;
	}
};
