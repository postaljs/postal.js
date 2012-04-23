define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/container.html'
],
	function ( $, ManagedView, template ) {
		// Using ECMAScript 5 strict mode during development. By default r.js will ignore that.
		"use strict";

		return ManagedView.extend( {
			el : "body",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
			},

			render : function () {
				this.$el.html( this.template );
			}
		} );
	} );