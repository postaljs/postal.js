define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/menu.html',
	'bus',
	'models/menu-model'
],
	function ( $, ManagedView, template, bus, MenuModel ) {
		"use strict";

		return ManagedView.extend( {
			el : "#menu",

			events : {
				"click #btnSearch" : "updateSearch"
			},

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new MenuModel();
				this.model.bind( "change", this.updateView );
			},

			updateSearch : function () {
				var searchTerm = this.$el.find( '#searchTerm' ).val();
				if ( searchTerm ) {
					bus.app.publish( {
						topic : "search.new.request",
						data : {
							searchTerm : searchTerm
						}
					} );
				}
			},

			updateView : function () {
				var $ownership = this.$el.find( "#search-ownership" ),
					mdlOwnership = this.model.get( "searchOwnership" ),
					dispOwnership = $ownership.text();
				if( dispOwnership && mdlOwnership !== dispOwnership ) {
					$ownership.text( this.model.get( "searchOwnership" ) )
								.animate({
									"font-size": "14pt",
									"margin-left" : "+=15"
								}, 500, function() {
									$ownership.stop().animate({
										"font-size" : "12pt",
										"margin-left" : "-=15"
									}, 400);
								});
				} else {
					$ownership.text( this.model.get( "searchOwnership" ) );
				}
				this.$el.find( "#currentSearch" ).text( this.model.get( "searchTerm" ) );
				this.$el.find( "#request-indicator" ).text( this.model.get( "requests" ) ? " *" : "" );
			}
		} );
	} );