define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/search-requests.html',
	'models/search-requests-model',
	'bus'
],
	function ( $, ManagedView, template, SearchRequestsModel, bus ) {
		"use strict";

		return ManagedView.extend( {
			el : "#requests",

			events : {
				"click a.req-allow" : "allowSearch"
			},

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new SearchRequestsModel();
				this.model.bind( "change", this.render );
			},

			allowSearch : function ( e ) {
				var idx = $( e.currentTarget ).attr( 'href' ),
					search = this.model.get( "requests" )[idx];
				if ( search ) {
					bus.app.publish( {
						topic : "search.new.confirm",
						data : search
					} )
				}
				e.preventDefault();
			}
		} );
	} );