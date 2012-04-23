define( [
	'backbone'
],
	function ( Backbone ) {
		"use strict";

		return function( defaults, subscriptions ) {
			var model = new (Backbone.Model.extend( {

				initialize : function () {
					_.bindAll( this );
					this.subscriptions = [];
				},

				dispose : function () {
					if( this.subscriptions ) {
						_.each( this.subscriptions, function ( subscription ) {
							subscription.unsubscribe();
						} );
					}
					this.clear( { silent : true } );
				}
			}))( defaults );

			_.each( subscriptions, function( sub ){
				sub.withContext( model );
			});

			model.subscriptions = subscriptions ;

			return model;
		};
	} );