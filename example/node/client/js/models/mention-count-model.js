define( [
	'backbone',
	'bus'
],
	function( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend({
			defaults: {
				mentions: []
			},

			initialize: function() {
				var self = this;
				this.subscriptions = [
					bus.stats.subscribe( "mention-count", function( data, env ){
						if( data.mentions && data.mentions.length ) {
							self.set( "mentions", _.sortBy( data.mentions, function( item ) { return item.count * -1; } ) );
						}
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