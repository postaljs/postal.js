define( [
	'backbone',
	'postal'
],
	function ( Backbone, postal ) {
		"use strict";

		var RawMessage = Backbone.Model.extend({
			defaults: {
				text: ""
			}
		});

		return Backbone.Collection.extend( {

			model: RawMessage,

			initialize : function () {
				var self = this;
				postal.addWireTap(function( data, envelope ){
					var text = "";
					try {
						text = JSON.stringify( envelope );
					}
					catch ( exception ) {
						try {
							var env = _.extend( {}, envelope );
							delete env.data;
							text = JSON.stringify( env ) + "\n\t" + "JSON.stringify Error: " + exception.message;
						}
						catch ( ex ) {
							text = "Unable to parse data to JSON: " + exception;
						}
					}
					self.add({ text: text });
				});
			}
		} );
	} );

