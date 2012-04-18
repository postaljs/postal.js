define( [
	'backbone',
	'bus'
],
	function( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend({
			defaults: {
				tweeters: []
			},

			initialize: function() {
				var self = this;
				this.subscriptions = [
					bus.stats.subscribe( "tweet-count", function( data, env ){
						if( data.tweeters && data.tweeters.length ) {
							self.set( "tweeters", _.sortBy( data.tweeters, function( item ) { return item.count * -1; } ) );
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