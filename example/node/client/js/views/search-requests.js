define( [
	'jquery',
	'backbone',
	'text!views/templates/search-requests.html',
	'models/search-requests-model',
	'bus'
],
	function( $, Backbone, template, SearchRequestsModel, bus ) {
		"use strict";

		return Backbone.View.extend( {
			el: "#requests",

			events: {
				"click a.req-allow": "allowSearch"
			},

			initialize: function() {
				_.bindAll( this );
				this.template = _.template( template );
				this.model = new SearchRequestsModel();
				this.model.bind( "change", this.render );
			},

			render: function() {
				this.$el.html( this.template( this.model.toJSON() ) );
			},

			show: function( data ) {
				this.$el.show();
			},

			hide: function( data ) {
				this.$el.hide();
			},

			allowSearch: function ( e ) {
				var idx = $( e.currentTarget).attr('href'),
					search = this.model.get("requests")[idx];
				if( search ) {
					bus.app.publish({
						topic: "search.new.confirm",
						data: search
					})
				}
				e.preventDefault();
			}
		} );
	} );