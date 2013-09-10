/*
 postal
 Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
 Version 0.8.9
 */
/*jshint -W098 */
(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = function ( _ ) {
			_ = _ || require( "underscore" );
			return factory( _ );
		};
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["underscore"], function ( _ ) {
			return factory( _, root );
		} );
	} else {
		// Browser globals
		root.postal = factory( root._, root );
	}
}( this, function ( _, global, undefined ) {

	var postal;

	/*jshint -W098 */
	var ConsecutiveDistinctPredicate = function () {
		var previous;
		return function ( data ) {
			var eq = false;
			if ( _.isString( data ) ) {
				eq = data === previous;
				previous = data;
			}
			else {
				eq = _.isEqual( data, previous );
				previous = _.clone( data );
			}
			return !eq;
		};
	};
	/*jshint -W098 */
	var DistinctPredicate = function () {
		var previous = [];
	
		return function ( data ) {
			var isDistinct = !_.any( previous, function ( p ) {
				if ( _.isObject( data ) || _.isArray( data ) ) {
					return _.isEqual( data, p );
				}
				return data === p;
			} );
			if ( isDistinct ) {
				previous.push( data );
			}
			return isDistinct;
		};
	};
	/* global postal, SubscriptionDefinition */
	var ChannelDefinition = function ( channelName ) {
		this.channel = channelName || postal.configuration.DEFAULT_CHANNEL;
	};
	
	ChannelDefinition.prototype.subscribe = function () {
		return arguments.length === 1 ?
		       new SubscriptionDefinition( this.channel, arguments[0].topic, arguments[0].callback ) :
		       new SubscriptionDefinition( this.channel, arguments[0], arguments[1] );
	};
	
	ChannelDefinition.prototype.publish = function () {
		var envelope = arguments.length === 1 ?
		               ( Object.prototype.toString.call( arguments[0] ) === "[object String]" ?
		                { topic : arguments[0] } :
		                arguments[0] ) :
		               { topic : arguments[0], data : arguments[1] };
		envelope.channel = this.channel;
		return postal.configuration.bus.publish( envelope );
	};
	/* global postal */
	/*jshint -W117 */
	var SubscriptionDefinition = function ( channel, topic, callback ) {
		this.channel = channel;
		this.topic = topic;
		this.callback = callback;
		this.constraints = [];
		this.context = null;
		postal.configuration.bus.publish( {
			channel : postal.configuration.SYSTEM_CHANNEL,
			topic   : "subscription.created",
			data    : {
				event   : "subscription.created",
				channel : channel,
				topic   : topic
			}
		} );
		postal.configuration.bus.subscribe( this );
	};
	
	SubscriptionDefinition.prototype = {
		unsubscribe : function () {
			if ( !this.inactive ) {
				this.inactive = true;
				postal.configuration.bus.unsubscribe( this );
				postal.configuration.bus.publish( {
					channel : postal.configuration.SYSTEM_CHANNEL,
					topic   : "subscription.removed",
					data    : {
						event   : "subscription.removed",
						channel : this.channel,
						topic   : this.topic
					}
				} );
			}
		},
	
		defer : function () {
			var self = this;
			var fn = this.callback;
			this.callback = function ( data, env ) {
				setTimeout( function () {
					fn.call( self.context, data, env );
				}, 0 );
			};
			return this;
		},
	
		disposeAfter : function ( maxCalls ) {
			if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
				throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
			}
			var self = this;
			var fn = this.callback;
			var dispose = _.after( maxCalls, _.bind( function () {
				this.unsubscribe();
			}, this ) );
	
			this.callback = function () {
				fn.apply( self.context, arguments );
				dispose();
			};
			return this;
		},
	
		distinctUntilChanged : function () {
			this.withConstraint( new ConsecutiveDistinctPredicate() );
			return this;
		},
	
		distinct : function () {
			this.withConstraint( new DistinctPredicate() );
			return this;
		},
	
		once : function () {
			this.disposeAfter( 1 );
			return this;
		},
	
		withConstraint : function ( predicate ) {
			if ( !_.isFunction( predicate ) ) {
				throw "Predicate constraint must be a function";
			}
			this.constraints.push( predicate );
			return this;
		},
	
		withConstraints : function ( predicates ) {
			var self = this;
			if ( _.isArray( predicates ) ) {
				_.each( predicates, function ( predicate ) {
					self.withConstraint( predicate );
				} );
			}
			return self;
		},
	
		withContext : function ( context ) {
			this.context = context;
			return this;
		},
	
		withDebounce : function ( milliseconds, immediate ) {
			if ( _.isNaN( milliseconds ) ) {
				throw "Milliseconds must be a number";
			}
			var fn = this.callback;
			this.callback = _.debounce( fn, milliseconds, !!immediate );
			return this;
		},
	
		withDelay : function ( milliseconds ) {
			if ( _.isNaN( milliseconds ) ) {
				throw "Milliseconds must be a number";
			}
			var self = this;
			var fn = this.callback;
			this.callback = function ( data, env ) {
				setTimeout( function () {
					fn.call( self.context, data, env );
				}, milliseconds );
			};
			return this;
		},
	
		withThrottle : function ( milliseconds ) {
			if ( _.isNaN( milliseconds ) ) {
				throw "Milliseconds must be a number";
			}
			var fn = this.callback;
			this.callback = _.throttle( fn, milliseconds );
			return this;
		},
	
		subscribe : function ( callback ) {
			this.callback = callback;
			return this;
		}
	};
	/*jshint -W098 */
	var bindingsResolver = {
		cache : {},
		regex : {},
	
		compare : function ( binding, topic ) {
			var pattern, rgx, prevSegment, result = ( this.cache[ topic ] && this.cache[ topic ][ binding ] );
			if ( typeof result !== "undefined" ) {
				return result;
			}
			if ( !( rgx = this.regex[ binding ] )) {
				pattern = "^" + _.map( binding.split( "." ),function ( segment ) {
					var res = "";
					if ( !!prevSegment ) {
						res = prevSegment !== "#" ? "\\.\\b" : "\\b";
					}
					if ( segment === "#" ) {
						res += "[\\s\\S]*";
					} else if ( segment === "*" ) {
						res += "[^.]+";
					} else {
						res += segment;
					}
					prevSegment = segment;
					return res;
				} ).join( "" ) + "$";
				rgx = this.regex[ binding ] = new RegExp( pattern );
			}
			this.cache[ topic ] = this.cache[ topic ] || {};
			this.cache[ topic ][ binding ] = result = rgx.test( topic );
			return result;
		},
	
		reset : function () {
			this.cache = {};
			this.regex = {};
		}
	};
	/* global postal */
	var fireSub = function ( subDef, envelope ) {
		if ( !subDef.inactive && postal.configuration.resolver.compare( subDef.topic, envelope.topic ) ) {
			if ( _.all( subDef.constraints, function ( constraint ) {
				return constraint.call( subDef.context, envelope.data, envelope );
			} ) ) {
				if ( typeof subDef.callback === "function" ) {
					subDef.callback.call( subDef.context, envelope.data, envelope );
				}
			}
		}
	};
	
	var pubInProgress = 0;
	var unSubQueue = [];
	var clearUnSubQueue = function () {
		while ( unSubQueue.length ) {
			unSubQueue.shift().unsubscribe();
		}
	};
	
	var localBus = {
		addWireTap : function ( callback ) {
			var self = this;
			self.wireTaps.push( callback );
			return function () {
				var idx = self.wireTaps.indexOf( callback );
				if ( idx !== -1 ) {
					self.wireTaps.splice( idx, 1 );
				}
			};
		},
	
		publish : function ( envelope ) {
			++pubInProgress;
			envelope.timeStamp = new Date();
			_.each( this.wireTaps, function ( tap ) {
				tap( envelope.data, envelope );
			} );
			if ( this.subscriptions[envelope.channel] ) {
				_.each( this.subscriptions[envelope.channel], function ( subscribers ) {
					var idx = 0, len = subscribers.length, subDef;
					while ( idx < len ) {
						if ( subDef = subscribers[idx++] ) {
							fireSub( subDef, envelope );
						}
					}
				} );
			}
			if ( --pubInProgress === 0 ) {
				clearUnSubQueue();
			}
			return envelope;
		},
	
		reset : function () {
			if ( this.subscriptions ) {
				_.each( this.subscriptions, function ( channel ) {
					_.each( channel, function ( topic ) {
						while ( topic.length ) {
							topic.pop().unsubscribe();
						}
					} );
				} );
				this.subscriptions = {};
			}
		},
	
		subscribe : function ( subDef ) {
			var channel = this.subscriptions[subDef.channel], subs;
			if ( !channel ) {
				channel = this.subscriptions[subDef.channel] = {};
			}
			subs = this.subscriptions[subDef.channel][subDef.topic];
			if ( !subs ) {
				subs = this.subscriptions[subDef.channel][subDef.topic] = [];
			}
			subs.push( subDef );
			return subDef;
		},
	
		subscriptions : {},
	
		wireTaps : [],
	
		unsubscribe : function ( config ) {
			if ( pubInProgress ) {
				unSubQueue.push( config );
				return;
			}
			if ( this.subscriptions[config.channel][config.topic] ) {
				var len = this.subscriptions[config.channel][config.topic].length,
					idx = 0;
				while ( idx < len ) {
					if ( this.subscriptions[config.channel][config.topic][idx] === config ) {
						this.subscriptions[config.channel][config.topic].splice( idx, 1 );
						break;
					}
					idx += 1;
				}
			}
		}
	};
	/* global localBus, bindingsResolver, ChannelDefinition, SubscriptionDefinition, postal */
	/*jshint -W020 */
	postal = {
		configuration : {
			bus             : localBus,
			resolver        : bindingsResolver,
			DEFAULT_CHANNEL : "/",
			SYSTEM_CHANNEL  : "postal"
		},
	
		ChannelDefinition      : ChannelDefinition,
		SubscriptionDefinition : SubscriptionDefinition,
	
		channel : function ( channelName ) {
			return new ChannelDefinition( channelName );
		},
	
		subscribe : function ( options ) {
			return new SubscriptionDefinition( options.channel || postal.configuration.DEFAULT_CHANNEL, options.topic, options.callback );
		},
	
		publish : function ( envelope ) {
			envelope.channel = envelope.channel || postal.configuration.DEFAULT_CHANNEL;
			return postal.configuration.bus.publish( envelope );
		},
	
		addWireTap : function ( callback ) {
			return this.configuration.bus.addWireTap( callback );
		},
	
		linkChannels : function ( sources, destinations ) {
			var result = [];
			sources = !_.isArray( sources ) ? [ sources ] : sources;
			destinations = !_.isArray( destinations ) ? [destinations] : destinations;
			_.each( sources, function ( source ) {
				var sourceTopic = source.topic || "#";
				_.each( destinations, function ( destination ) {
					var destChannel = destination.channel || postal.configuration.DEFAULT_CHANNEL;
					result.push(
						postal.subscribe( {
							channel  : source.channel || postal.configuration.DEFAULT_CHANNEL,
							topic    : sourceTopic,
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
				     Object.prototype.hasOwnProperty.call( postal.configuration.bus.subscriptions[ channel ], tpc ) ) {
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
	localBus.subscriptions[postal.configuration.SYSTEM_CHANNEL] = {};

	/*jshint -W106 */
	if ( global && global.hasOwnProperty( "__postalReady__" ) && _.isArray( global.__postalReady__ ) ) {
		while(global.__postalReady__.length) {
			global.__postalReady__.shift().onReady(postal);
		}
	}
	/*jshint +W106 */

	return postal;
} ));