define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/wiretap.html',
	'models/wiretap-model'
],
	function ( $, ManagedView, template, WiretapModel ) {
		"use strict";

		return ManagedView.extend( {
			el : "#wiretap",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new WiretapModel();
				this.model.bind( "add", this.render );
			},

			render : function () {
				this.$el.html( this.template( { messages: this.model.toJSON() } ) );
				// Yes, I know - quick, dirty and ugly :-)
				this.$el.find(".scrollableDiv").animate({ scrollTop: this.$el.find(".scrollableDiv")[0].scrollHeight }, "fast");
			}
		} );
	} );