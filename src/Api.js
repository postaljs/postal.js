var postal = {
	configuration : {
		bus : localBus,
		resolver : bindingsResolver,
		DEFAULT_CHANNEL : DEFAULT_CHANNEL,
		SYSTEM_CHANNEL : SYSTEM_CHANNEL
	},

	ChannelDefinition : ChannelDefinition,
	SubscriptionDefinition : SubscriptionDefinition,

	channel : function ( channelName ) {
		return new ChannelDefinition( channelName );
	},

	subscribe : function ( options ) {
		return new SubscriptionDefinition( options.channel || DEFAULT_CHANNEL, options.topic, options.callback );
	},

	publish : function ( envelope ) {
		envelope.channel = envelope.channel || DEFAULT_CHANNEL;
		return postal.configuration.bus.publish( envelope );
	},

	addWireTap : function ( callback ) {
		return this.configuration.bus.addWireTap( callback );
	},

	linkChannels : function ( sources, destinations ) {
		var result   = [];
		sources      = !_.isArray( sources ) ? [sources] : sources;
		destinations = !_.isArray( destinations ) ? [destinations] : destinations;
		_.each( sources, function ( source ) {
			var sourceTopic = source.topic || "#";
			_.each( destinations, function ( destination ) {
				var destChannel = destination.channel || DEFAULT_CHANNEL;
				result.push(
					postal.subscribe( {
						channel : source.channel || DEFAULT_CHANNEL,
						topic : source.topic || "#",
						callback : function ( data, env ) {
							var newEnv = _.clone( env );
							newEnv.topic = _.isFunction( destination.topic ) ? destination.topic( env.topic ) : destination.topic || env.topic;
							newEnv.channel = destChannel;
							newEnv.data = data;
							postal.publish( newEnv );
						}
					} )
				);
			} );
		} );
		return result;
	},

	utils : {
		getSubscribersFor : function () {
			var channel = arguments[ 0 ],
				tpc = arguments[ 1 ];
			if ( arguments.length === 1 ) {
				channel = arguments[ 0 ].channel || postal.configuration.DEFAULT_CHANNEL;
				tpc = arguments[ 0 ].topic;
			}
			if ( postal.configuration.bus.subscriptions[ channel ] &&
			     postal.configuration.bus.subscriptions[ channel ].hasOwnProperty( tpc ) ) {
				return postal.configuration.bus.subscriptions[ channel ][ tpc ];
			}
			return [];
		},

		reset : function () {
			postal.configuration.bus.reset();
			postal.configuration.resolver.reset();
		}
	}
};