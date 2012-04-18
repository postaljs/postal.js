define( [
	'backbone',
	'bus'
],
	function( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend({
			defaults: {
				sessionId: "",
				searchOwnership: "",
				searchTerm: "",
				requests: []
			},

			initialize: function() {
				_.bindAll( this );
				this.subscriptions = [
					bus.app.subscribe( "search.info", this.setCurrentSearch ),
					bus.app.subscribe( "search.new.ask", this.updateRequests )
				];
				bus.app.publish({
					topic: "get.search.info",
					data: {}
				});
			},

			dispose: function(){
				_.each( this.subscriptions, function( subscription ){
					subscription.unsubscribe();
				});
				this.clear( { silent: true } );
			},

			setCurrentSearch: function( data, env ) {
				var self = this;
				self.set( "searchTerm", data.searchTerm );
				postal.configuration.getSessionIdentifier(
					function( id ) {
						self.set( "sessionId", id, { silent: true } );
						self.set( "searchOwnership",
							(id === data.id)
								? "You own the search."
								: "You do not own the search."
						);
					}
				);
			},

			updateRequests: function( data, env ) {
				var reqs = this.get( "requests" );
				if( !_.any( reqs, function( req ){
					return req.correlationId === data.correlationId &&
						req.searchTerm === data.searchTerm
				})) {
					reqs.push( data );
					this.set( "requests", _.sortBy( reqs, function( item ) { return item.searchTerm; } ) );
				}
			}
		});
	});