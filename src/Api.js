/* global bindingsResolver, ChannelDefinition, SubscriptionDefinition, _postal, prevPostal, global, Conduit */
/*jshint -W020 */

var pubInProgress = 0;
var unSubQueue = [];

function clearUnSubQueue() {
	while (unSubQueue.length) {
		_postal.unsubscribe( unSubQueue.shift() );
	}
}

function getCachePurger( subDef, key, cache ) {
	return function( sub, i, list ) {
		if ( sub === subDef ) {
			list.splice( i, 1 );
		}
		if ( list.length === 0 ) {
			delete cache[ key ];
		}
	};
}

function getCacher( configuration, topic, cache, cacheKey, done ) {
	return function( subDef ) {
		if ( configuration.resolver.compare( subDef.topic, topic ) ) {
			cache.push( subDef );
			subDef.cacheKeys.push( cacheKey );
			if ( done ) {
				done( subDef );
			}
		}
	};
}

function getSystemMessage( kind, subDef ) {
	return {
		channel: _postal.configuration.SYSTEM_CHANNEL,
		topic: "subscription." + kind,
		data: {
			event: "subscription." + kind,
			channel: subDef.channel,
			topic: subDef.topic
		}
	};
}

var sysCreatedMessage = _.bind( getSystemMessage, this, "created" );
var sysRemovedMessage = _.bind( getSystemMessage, this, "removed" );

function getPredicate( options, resolver ) {
	if ( typeof options === "function" ) {
		return options;
	} else if ( !options ) {
		return function() {
			return true;
		};
	} else {
		return function( sub ) {
			var compared = 0,
				matched = 0;
			_.each( options, function( val, prop ) {
				compared += 1;
				if (
				// We use the bindings resolver to compare the options.topic to subDef.topic
				( prop === "topic" && resolver.compare( sub.topic, options.topic ) )
						|| ( prop === "context" && options.context === sub._context )
						// Any other potential prop/value matching outside topic & context...
						|| ( sub[ prop ] === options[ prop ] ) ) {
					matched += 1;
				}
			} );
			return compared === matched;
		};
	}
}

_postal = {
	cache: {},
	configuration: {
		resolver: bindingsResolver,
		DEFAULT_CHANNEL: "/",
		SYSTEM_CHANNEL: "postal",
		enableSystemMessages: true,
		cacheKeyDelimiter: "|"
	},
	subscriptions: {},
	wireTaps: [],

	ChannelDefinition: ChannelDefinition,
	SubscriptionDefinition: SubscriptionDefinition,

	channel: function channel( channelName ) {
		return new ChannelDefinition( channelName, this );
	},

	addWireTap: function addWireTap( callback ) {
		var self = this;
		self.wireTaps.push( callback );
		return function() {
			var idx = self.wireTaps.indexOf( callback );
			if ( idx !== -1 ) {
				self.wireTaps.splice( idx, 1 );
			}
		};
	},

	noConflict: function noConflict() {
		/* istanbul ignore else */
		if ( typeof window === "undefined" || ( typeof window !== "undefined" && typeof define === "function" && define.amd ) ) {
			throw new Error( "noConflict can only be used in browser clients which aren't using AMD modules" );
		}
		global.postal = prevPostal;
		return this;
	},

	getSubscribersFor: function getSubscribersFor( options ) {
		var result = [];
		var self = this;
		_.each( self.subscriptions, function( channel ) {
			_.each( channel, function( subList ) {
				result = result.concat( _.filter( subList, getPredicate( options, self.configuration.resolver ) ) );
			} );
		} );
		return result;
	},

	publish: function publish( envelope ) {
		++pubInProgress;
		var configuration = this.configuration;
		var channel = envelope.channel = envelope.channel || configuration.DEFAULT_CHANNEL;
		var topic = envelope.topic;
		envelope.timeStamp = new Date();
		if ( this.wireTaps.length ) {
			_.each( this.wireTaps, function( tap ) {
				tap( envelope.data, envelope, pubInProgress );
			} );
		}
		var cacheKey = channel + configuration.cacheKeyDelimiter + topic;
		var cache = this.cache[ cacheKey ];
		if ( !cache ) {
			cache = this.cache[ cacheKey ] = [];
			var cacherFn = getCacher(
				configuration,
				topic,
				cache,
				cacheKey, function( candidate ) {
					candidate.invokeSubscriber( envelope.data, envelope );
				}
			);
			_.each( this.subscriptions[ channel ], function( candidates ) {
				_.each( candidates, cacherFn );
			} );
		} else {
			_.each( cache, function( subDef ) {
				subDef.invokeSubscriber( envelope.data, envelope );
			} );
		}
		if ( --pubInProgress === 0 ) {
			clearUnSubQueue();
		}
	},

	reset: function reset() {
		this.unsubscribeFor();
		this.configuration.resolver.reset();
		this.subscriptions = {};
	},

	subscribe: function subscribe( options ) {
		var subscriptions = this.subscriptions;
		var subDef = new SubscriptionDefinition( options.channel || this.configuration.DEFAULT_CHANNEL, options.topic, options.callback );
		var channel = subscriptions[ subDef.channel ];
		var channelLen = subDef.channel.length;
		var configuration = this.configuration;
		var subs;
		if ( !channel ) {
			channel = subscriptions[ subDef.channel ] = {};
		}
		subs = subscriptions[ subDef.channel ][ subDef.topic ];
		if ( !subs ) {
			subs = subscriptions[ subDef.channel ][ subDef.topic ] = [];
		}
		// First, add the SubscriptionDefinition to the channel list
		subs.push( subDef );
		// Next, add the SubscriptionDefinition to any relevant existing cache(s)
		_.each( this.cache, function( list, cacheKey ) {
			if ( cacheKey.substr( 0, channelLen ) === subDef.channel ) {
				getCacher(
					configuration,
					cacheKey.split( configuration.cacheKeyDelimiter )[ 1 ],
					list,
					cacheKey )( subDef );
			}
		} );
		/* istanbul ignore else */
		if ( this.configuration.enableSystemMessages ) {
			this.publish( sysCreatedMessage( subDef ) );
		}
		return subDef;
	},

	unsubscribe: function unsubscribe() {
		var unSubLen = arguments.length;
		var unSubIdx = 0;
		var subDef;
		var channelSubs;
		var topicSubs;
		var idx;
		for (; unSubIdx < unSubLen; unSubIdx++) {
			subDef = arguments[ unSubIdx ];
			subDef.inactive = true;
			if ( pubInProgress ) {
				unSubQueue.push( subDef );
				return;
			}
			channelSubs = this.subscriptions[ subDef.channel ];
			topicSubs = channelSubs && channelSubs[ subDef.topic ];
			/* istanbul ignore else */
			if ( topicSubs ) {
				var len = topicSubs.length;
				idx = 0;
				// remove SubscriptionDefinition from channel list
				while (idx < len) {
					/* istanbul ignore else */
					if ( topicSubs[ idx ] === subDef ) {
						topicSubs.splice( idx, 1 );
						break;
					}
					idx += 1;
				}
				// remove SubscriptionDefinition from cache
				if ( subDef.cacheKeys && subDef.cacheKeys.length ) {
					var key;
					while (key = subDef.cacheKeys.pop()) {
						_.each( this.cache[ key ], getCachePurger( subDef, key, this.cache ) );
					}
				}
				if ( topicSubs.length === 0 ) {
					delete channelSubs[ subDef.topic ];
					if ( _.isEmpty( channelSubs ) ) {
						delete this.subscriptions[ subDef.channel ];
					}
				}
			}
			if ( this.configuration.enableSystemMessages ) {
				this.publish( sysRemovedMessage( subDef ) );
			}
		}
	},

	unsubscribeFor: function unsubscribeFor( options ) {
		var toDispose = [];
		/* istanbul ignore else */
		if ( this.subscriptions ) {
			toDispose = this.getSubscribersFor( options );
			this.unsubscribe.apply( this, toDispose );
		}
	}
};

_postal.subscriptions[ _postal.configuration.SYSTEM_CHANNEL ] = {};
