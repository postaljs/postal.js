/* global _postal */
/*jshint -W117 */
var SubscriptionDefinition = function ( channel, topic, callback ) {
    if(arguments.length !== 3) {
        throw new Error("You must provide a channel, topic and callback when creating a SubscriptionDefinition instance.");
    }
    if(topic.length === 0) {
        throw new Error("Topics cannot be empty");
    }

    var report = function() {};
    if( console ) {
        if( console.warn ) {
            report = console.warn;
        } else {
            report = console.log;
        }
    }

    this.errorHandler = report;
    this.channel = channel;
    this.topic = topic;
    this.subscribe(callback);
};

SubscriptionDefinition.prototype = {
	unsubscribe : function () {
		if ( !this.inactive ) {
			this.inactive = true;
            _postal.unsubscribe( this );
		}
	},

    subscribe : function ( callback ) {
        this.callback = callback;
        return this;
    },

    withContext : function ( context ) {
        this.context = context;
        return this;
    }
};


