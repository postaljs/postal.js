define( [
	'underscore',
	'jquery',
	'backbone'
],
	function ( _, $, Backbone ) {
		"use strict";

		return Backbone.View.extend( {

			initialize : function ( template ) {
				_.bindAll( this );
				if( template ) {
					this.template = _.template( template );
				}
			},

			render : function () {
				this.$el.html( this.template( this.model.toJSON() ) );
			},

			show : function () {
				this.$el.show();
			},

			hide : function () {
				this.$el.hide();
			}
		} );
	} );