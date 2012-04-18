define([
	'jquery',
	'backbone',
	'bus'
], function( $, Backbone, bus ){

	return Backbone.Router.extend({
		routes: {
			""          : "home",
			"select"    : "select",
			"wiretap"   : "wiretap",
			"*anything" : "redirect"
		},

		initialize: function() {
			var self = this;
			_.bindAll( self );

			$( document ).delegate( "a.ps-nav", "click", function( e ){
				e.preventDefault();
				self.navigate( $( this ).attr( 'href' ), { trigger: true });
			});
			bus.router.publish( "initialized" );
		},

		activateUI: function( uiName, context ) {
			bus.viewManager.publish({
				topic: "ui.show",
				data: {
					name: uiName,
					context: context
				}
			});
		},

		home: function() {
			this.activateUI( "homeUI" );
		},

		select: function() {
			this.activateUI( "statSelectionUI" );
		},

		wiretap: function() {
			this.activateUI( "wireTapLogUI" );
		},

		redirect: function() {
			this.navigate( "/", { trigger: true });
		}
	});
});