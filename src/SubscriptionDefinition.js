var SubscriptionDefinition = function ( channel, topic, callback ) {
	this.channel = channel;
	this.topic = topic;
	this.callback = callback;
	this.constraints = [];
	this.context = null;
	postal.configuration.bus.publish( {
		channel : SYSTEM_CHANNEL,
		topic : "subscription.created",
		data : {
			event : "subscription.created",
			channel : channel,
			topic : topic
		}
	} );
	postal.configuration.bus.subscribe( this );
};

SubscriptionDefinition.prototype = {
	unsubscribe : function () {
		postal.configuration.bus.unsubscribe( this );
		postal.configuration.bus.publish( {
			channel : SYSTEM_CHANNEL,
			topic : "subscription.removed",
			data : {
				event : "subscription.removed",
				channel : this.channel,
				topic : this.topic
			}
		} );
	},

	defer : function () {
		var fn = this.callback;
		this.callback = function ( data ) {
			setTimeout( function () {
				fn( data );
			}, 0 );
		};
		return this;
	},

	disposeAfter : function ( maxCalls ) {
		if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
			throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
		}
		var fn = this.callback;
		var dispose = _.after( maxCalls, _.bind( function () {
			this.unsubscribe();
		}, this ) );

		this.callback = function () {
			fn.apply( this.context, arguments );
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

	withDebounce : function ( milliseconds ) {
		if ( _.isNaN( milliseconds ) ) {
			throw "Milliseconds must be a number";
		}
		var fn = this.callback;
		this.callback = _.debounce( fn, milliseconds );
		return this;
	},

	withDelay : function ( milliseconds ) {
		if ( _.isNaN( milliseconds ) ) {
			throw "Milliseconds must be a number";
		}
		var fn = this.callback;
		this.callback = function ( data ) {
			setTimeout( function () {
				fn( data );
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