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

	changePriority : function ( subDef ) {
		var idx, found;
		if ( this.subscriptions[subDef.channel] && this.subscriptions[subDef.channel][subDef.topic] ) {
			this.subscriptions[subDef.channel][subDef.topic] = _.without( this.subscriptions[subDef.channel][subDef.topic], subDef );
			idx = this.subscriptions[subDef.channel][subDef.topic].length - 1;
			for ( ; idx >= 0; idx-- ) {
				if ( this.subscriptions[subDef.channel][subDef.topic][idx].priority <= subDef.priority ) {
					this.subscriptions[subDef.channel][subDef.topic].splice( idx + 1, 0, subDef );
					found = true;
					break;
				}
			}
			if ( !found ) {
				this.subscriptions[subDef.channel][subDef.topic].unshift( subDef );
			}
		}
	},

	publish : function ( envelope ) {
		_.each( this.wireTaps, function ( tap ) {
			tap( envelope.data, envelope );
		} );

		if ( this.subscriptions[envelope.channel] ) {
			_.each( this.subscriptions[envelope.channel], function ( topic ) {
				// TODO: research faster ways to handle this than _.clone
				_.each( _.clone( topic ), function ( subDef ) {
					if ( postal.configuration.resolver.compare( subDef.topic, envelope.topic ) ) {
						if ( _.all( subDef.constraints, function ( constraint ) {
							return constraint( envelope.data, envelope );
						} ) ) {
							if ( typeof subDef.callback === 'function' ) {
								subDef.callback.apply( subDef.context, [envelope.data, envelope] );
								subDef.onHandled();
							}
						}
					}
				} );
			} );
		}

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
		var idx, found, fn, channel = this.subscriptions[subDef.channel], subs;

		if ( !channel ) {
			channel = this.subscriptions[subDef.channel] = {};
		}
		subs = this.subscriptions[subDef.channel][subDef.topic];
		if ( !subs ) {
			subs = this.subscriptions[subDef.channel][subDef.topic] = new Array( 0 );
		}
		subs.push( subDef );
		return subDef;
	},

	subscriptions : {},

	wireTaps : new Array( 0 ),

	unsubscribe : function ( config ) {
		if ( this.subscriptions[config.channel][config.topic] ) {
			var len = this.subscriptions[config.channel][config.topic].length,
				idx = 0;
			for ( ; idx < len; idx++ ) {
				if ( this.subscriptions[config.channel][config.topic][idx] === config ) {
					this.subscriptions[config.channel][config.topic].splice( idx, 1 );
					break;
				}
			}
		}
	}
};
