var SubscriptionDefinition = function ( channel, topic, callback ) {
	this.channel = channel;
	this.topic = topic;
	this.callback = callback;
	this.priority = DEFAULT_PRIORITY;
	this.constraints = new Array( 0 );
	this.maxCalls = DEFAULT_DISPOSEAFTER;
	this.onHandled = NO_OP;
	this.context = null;
	postal.configuration.bus.publish( {
		channel : SYSTEM_CHANNEL,
		topic : "subscription.created",
		timeStamp : new Date(),
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
			timeStamp : new Date(),
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
			setTimeout( fn, 0, data );
		};
		return this;
	},

	disposeAfter : function ( maxCalls ) {
		if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
			throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
		}

		var fn = this.onHandled;
		var dispose = _.after( maxCalls, _.bind( function () {
			this.unsubscribe( this );
		}, this ) );

		this.onHandled = function () {
			fn.apply( this.context, arguments );
			dispose();
		};
		return this;
	},

	ignoreDuplicates : function () {
		this.withConstraint( new DistinctPredicate() );
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

	withPriority : function ( priority ) {
		if ( _.isNaN( priority ) ) {
			throw "Priority must be a number";
		}
		this.priority = priority;
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
