define( [
	'backbone',
	'bus'
],
	function ( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend( {
			defaults : {
				mentioners : []
			},

			initialize : function () {
				var self = this;
				this.subscriptions = [
					bus.stats.subscribe( "mentioner-count", function ( data, env ) {
						if ( data.mentioners && data.mentioners.length ) {
							self.set( "mentioners", _.sortBy( data.mentioners, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ),
					bus.app.subscribe( "search.init", function () {
						self.set( "mentioners", [] );
					} )
				];
			},

			dispose : function () {
				_.each( this.subscriptions, function ( subscription ) {
					subscription.unsubscribe();
				} );
				this.clear( { silent : true } );
			}
		} );
	} );