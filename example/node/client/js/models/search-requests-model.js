define( [
	'backbone',
	'bus'
],
	function ( Backbone, bus ) {
		"use strict";

		return Backbone.Model.extend( {
			defaults : {
				requests : [],
				ownerId : undefined,
				sessionId : undefined
			},

			initialize : function () {
				_.bindAll( this );
				this.setSessionId();
				this.subscriptions = [
					bus.app.subscribe( "search.info", this.setOwner ).withContext( this ),
					bus.app.subscribe( "search.requests", this.updateRequests ).withContext( this ),
					bus.app.subscribe( "search.new.ask", this.addRequest ).withContext( this ),
					bus.app.subscribe( "search.init", this.askForUpdate ).withContext( this )
				];
				this.askForUpdate();
			},

			askForUpdate : function () {
				bus.app.publish( {
					topic : "get.search.requests",
					data : {}
				} );
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

			setOwner : function ( data, env ) {
				this.set( "ownerId", data.id );
				this.setSessionId();
			},

			setSessionId : function () {
				var self = this;
				postal.utils.getSessionId(
					function ( session ) {
						self.set( "sessionId", session.id );
					}
				);
			},

			updateRequests : function ( data, env ) {
				var reqs = _.sortBy( data, function ( item ) {
					return item.searchTerm;
				});
				this.set( "requests", reqs );
			},

			addRequest : function ( data, env ) {
				this.askForUpdate();
			}
		} );
	} );