/* global _postal */
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
            _postal.unsubscribe( this );
		}
	},

    // Move strat optimization here....
    subscribe : function ( callback ) {
        this.callback = callback;
        this.callback = new Strategy({
            owner    : this,
            prop     : "callback",
            context  : this, // TODO: is this the best option?
            lazyInit : true
        });
        return this;
    },

    withContext : function ( context ) {
        this.callback.context(context);
        return this;
    }
};


