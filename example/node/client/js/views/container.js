define( [
	'jquery',
	'backbone',
	'text!views/templates/container.html'
],
	function ( $, Backbone, template ) {
		// Using ECMAScript 5 strict mode during development. By default r.js will ignore that.
		"use strict";

		return Backbone.View.extend( {
			el : "body",

			initialize : function () {
				_.bindAll( this, "render" );
				this.template = template;
			},

			render : function () {
				this.$el.html( this.template );
			},

			show : function ( data ) {
				this.$el.show();
			},

			update : function ( data ) {

			}
		} );
	} );