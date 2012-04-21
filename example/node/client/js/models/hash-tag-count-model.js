define( [
	'backbone',
	'bus'
],
	function ( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend( {
			defaults : {
				hashTags : []
			},

			initialize : function () {
				var self = this;
				this.subscriptions = [
					bus.stats.subscribe( "hash-tag-count", function ( data, env ) {
						if ( data.hashTags && data.hashTags.length ) {
							self.set( "hashTags", _.sortBy( data.hashTags, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ),
					bus.app.subscribe( "search.init", function () {
						self.set( "hashTags", [] );
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