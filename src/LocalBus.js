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
		localBus.unsubscribe(unSubQueue.shift());
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