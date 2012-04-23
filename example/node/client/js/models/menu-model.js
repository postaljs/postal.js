define( [
	'backbone',
	'bus'
],
	function ( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend( {
			defaults : {
				sessionId : "",
				searchOwnership : "",
				searchTerm : "",
				requests : false
			},

			initialize : function () {
				this.subscriptions = [
					bus.app.subscribe( "search.info", this.setCurrentSearch ).withContext( this ),
					bus.app.subscribe( "search.new.ask", this.updateReqCount ).withContext( this ),
					bus.app.subscribe( "search.requests", this.updateReqCount ).withContext( this )
				];
				bus.app.publish( {
					topic : "get.search.info",
					data : {}
				} );
			},

			dispose : function () {
				_.each( this.subscriptions, function ( subscription ) {
					subscription.unsubscribe();
				} );
				this.clear( { silent : true } );
			},

			setCurrentSearch : function ( data, env ) {
				var self = this;
				self.set( "searchTerm", data.searchTerm );
				postal.utils.getSessionId(
					function ( session ) {
						self.set( "sessionId", session.id, { silent : true } );
						self.set( "searchOwnership",
							(session.id === data.id)
								? "You own the search."
								: "You do not own the search."
						);
					}
				);
			},

			updateReqCount : function ( data, env ) {
				if ( (_.isArray( data ) && data.length) || data.searchTerm ) {
					this.set( "requests", true );
				}
				else {
					this.set( "requests", false );
				}
				this.change( "requests" );
			}
		} );
	} );