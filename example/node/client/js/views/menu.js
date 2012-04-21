define( [
	'jquery',
	'backbone',
	'text!views/templates/menu.html',
	'bus',
	'models/menu-model'
],
	function ( $, Backbone, template, bus, MenuModel ) {
		"use strict";

		return Backbone.View.extend( {
			el : "#menu",

			events : {
				"click #btnSearch" : "updateSearch"
			},

			initialize : function () {
				_.bindAll( this );
				this.template = _.template( template );
				this.model = new MenuModel();
				this.model.bind( "change", this.updateView );
			},

			render : function () {
				this.$el.html( this.template( this.model.toJSON() ) );
			},

			show : function ( data ) {
				this.$el.show();
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
				this.$el.find( "#currentSearch" ).text( this.model.get( "searchTerm" ) );
				this.$el.find( "#search-ownership" ).text( this.model.get( "searchOwnership" ) );
				this.$el.find( "#request-indicator" ).text( this.model.get( "requests" ) ? " *" : "" );
			}
		} );
	} );