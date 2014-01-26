/* global postal */
/*jshint -W117 */
var SubscriptionDefinition = function ( channel, topic, callback ) {
    if(arguments.length !== 3) {
        throw new Error("You must provide a channel, topic and callback when creating a SubscriptionDefinition instance.");
    }
    if(topic.length === 0) {
        throw new Error("Topics cannot be empty");
    }
    this.channel = channel;
    this.topic = topic;
    this.subscribe(callback);
};

SubscriptionDefinition.prototype = {
	unsubscribe : function () {
		if ( !this.inactive ) {
			this.inactive = true;
			postal.unsubscribe( this );
		}
	},

    defer : function () {
        this.callback.useStrategy(postal.configuration.strategies.setTimeout(0));
        return this;
    },

    disposeAfter : function ( maxCalls ) {
        if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
            throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
        }
        var self = this;
        self.callback.useStrategy(postal.configuration.strategies.after(maxCalls, function() {
            self.unsubscribe.call(self);
        }));
        return self;
    },

    distinctUntilChanged : function () {
        this.callback.useStrategy(postal.configuration.strategies.distinct());
        return this;
    },

    distinct : function () {
        this.callback.useStrategy(postal.configuration.strategies.distinct({ all: true }));
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
        this.callback.useStrategy(postal.configuration.strategies.predicate(predicate));
        return this;
    },

    withContext : function ( context ) {
        this.callback.context(context);
        return this;
    },

    withDebounce : function ( milliseconds, immediate ) {
        if ( _.isNaN( milliseconds ) ) {
            throw "Milliseconds must be a number";
        }
        this.callback.useStrategy(postal.configuration.strategies.debounce(milliseconds, immediate));
        return this;
    },

    withDelay : function ( milliseconds ) {
        if ( _.isNaN( milliseconds ) ) {
            throw "Milliseconds must be a number";
        }
        this.callback.useStrategy(postal.configuration.strategies.setTimeout(milliseconds));
        return this;
    },

    withThrottle : function ( milliseconds ) {
        if ( _.isNaN( milliseconds ) ) {
            throw "Milliseconds must be a number";
        }
        this.callback.useStrategy(postal.configuration.strategies.throttle(milliseconds));
        return this;
    },

    subscribe : function ( callback ) {
        this.callback = callback;
        this.callback = new Strategy({
            owner    : this,
            prop     : "callback",
            context  : this, // TODO: is this the best option?
            lazyInit : true
        });
        return this;
    }
};