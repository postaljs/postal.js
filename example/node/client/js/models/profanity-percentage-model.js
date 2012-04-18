define( [
	'backbone',
	'bus'
],
	function( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend({
			defaults: {
				percentage: "",
				clean: "",
				explicit: "",
				total: ""
			},

			initialize: function() {
				var self = this;
				this.subscriptions = [
					bus.stats.subscribe( "profanity-percentage", function( data, env ){
						self.set("percentage", data.percentage, { silent: true });
						self.set("clean", data.clean, { silent: true });
						self.set("explicit", data.explicit, { silent: true });
						self.set("total", data.clean + data.explicit, { silent: true });
						self.change();
					})
				];
			},

			dispose: function(){
				_.each( this.subscriptions, function( subscription ){
					subscription.unsubscribe();
				});
				this.clear( { silent: true } );
			}
		});
	});