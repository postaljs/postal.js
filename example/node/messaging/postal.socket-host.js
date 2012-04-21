var _ = require( 'underscore' ),
	machina = require( '../machina.js' );

/*
 A RemoteClientProxy instance is a finite state machine that manages
 how a socket is used, and how it is (or isn't) allowed to interact
 with the server-side instance of postal, depending on the state
 related to the connection and the client on the other end of the socket.
 */
var RemoteClientProxy = function ( postal, socketClient, bridge ) {
	// helper function to handle when a socket client wants
	// to set up a subscription to server-side messages
	var subscribe = function ( data ) {
			var self = this;
			if ( !self.subscriptions[ data.channel ] ) {
				self.subscriptions[ data.channel ] = {};
			}
			if ( !self.subscriptions[ data.channel ][ data.topic ] ) {
				self.subscriptions[ data.channel ][ data.topic ] =
				postal.subscribe( {
					channel : data.channel,
					topic : data.topic,
					callback : function ( d, e ) {
						self.handle( "socketTransmit", d, e );
					}
				} ).withConstraint( function ( data, env ) {
						if ( !env.correlationId ) {
							return true;
						}
						return env.correlationId === self.sessionId;
					} );
			}
		},
	// The actual FSM managing the socketClient
		fsm = new machina.Fsm( {
			// handle to the socket client wrapper
			socket : socketClient,

			// object used to store (and lookup) subscriptions owned by this connection/client
			subscriptions : {},

			// method to allow a RemoteClientProxy to hand off state to another RemoteClientProxy
			// as part of a migration
			getClientState : function () {
				return {
					queuedMsgs : _.filter( this.eventQueue, function ( item ) {
						return item.args[0] === "socketTransmit";
					} )
				};
			},

			sessionId : null,

			states : {
				// we start here after an explicit transition from uninitialized
				// the only message we are interested in is "clientId" - in which
				// the client tells us who they are, and we determine if we need
				// to move through a migration first, or go directly to 'connected'
				connecting : {
					"*" : function () {
						this.deferUntilTransition();
					},
					clientId : function ( session ) {
						console.log( "SESSION STUFF: " + JSON.stringify( session ) );
						this.sessionId = session.id;
						if ( bridge.enableMigration && session.lastId && session.lastId !== session.id ) {
							this.lastSessionId = session.lastId;
							this.transition( "migrating" );
						}
						else {
							this.transition( "connected" );
						}
					}
				},
				// we're going to get any relevant state from the old RemoteClientProxy
				// and apply it to this instance.  This includes the publishing of
				// messages that got queued up at the old RemoteClientProxy.
				migrating : {
					// We tell the client to handle it's migration work (if any) first.
					_onEnter : function () {
						console.log( "TELLING CLIENT TO MIGRATE" )
						this.socket.migrateClientSubscriptions();
					},
					// Once the client has completed its migration tasks, it will
					// publish a message that triggers this handler.  This is where we
					// transfer queued messages from the old RemoteClientProxy, etc.
					migrationComplete : function ( data ) {
						if ( bridge.clientMap[ this.lastSessionId ] ) {
							console.log( "LAST SESSION ID EXISTS" )
							var priorState = bridge.clientMap[ this.lastSessionId ].getClientState();
							_.each( priorState.queuedMsgs, function ( item ) {
								this.eventQueue.unshift( item );
							}, this );
						}
						postal.publish( {
							channel : "postal.socket",
							topic : "client.migrated",
							data : {
								sessionId : this.socket.id,
								lastSessionId : this.lastSessionId
							}
						} );
						this.transition( "connected" );
					},
					subscribe : subscribe,
					"*" : function () {
						this.deferUntilTransition();
					}
				},
				// We're online and this is how to handle it....
				connected : {
					_onEnter : function () {
						bridge.clientMap[ this.sessionId ] = this;
						this.socket.confirmClientIdentified( this.sessionId );
					},
					disconnect : function () {
						this.transition( "disconnected" );
					},
					subscribe : subscribe,
					unsubscribe : function ( data ) {
						if ( this.subscriptions[ data.channel ] && this.subscriptions[ data.channel ][ data.topic ] ) {
							this.subscriptions[ data.channel ] && this.subscriptions[ data.channel ][ data.topic ].unsubscribe();
						}
					},
					publish : function ( envelope ) {
						postal.publish( envelope );
					},
					socketTransmit : function ( data, envelope ) {
						this.socket.publish.call( this.socket, data, envelope );
					}
				},
				disconnected : {
					_onEnter : function () {
						postal.publish( {
							channel : "postal.socket",
							topic : "client.disconnect",
							data : {
								sessionId : this.sessionId
							}
						} );
					},
					"*" : function () {
						this.deferUntilTransition();
					},
					socketTransmit : function () {
						this.deferUntilTransition( "connected" );
					}
				}
			}
		} );
	// These are all the events from our Socket Client wrapper to which we need to listen.
	_.each( [ "disconnect", "subscribe", "unsubscribe", "publish", "clientId", "migrationComplete" ], function ( evnt ) {
		socketClient.on( evnt, function ( data ) {
			fsm.handle( evnt, data );
		} );
	} );

	// This is currently here for debugging purposes only
	fsm.on( "*", function ( evnt, data ) {
		var args = [].slice.call( arguments, 1 );
		if ( evnt === "Deferred" || args[0] === "socketTransmit" ) {
			console.log( "Socket FSM: " + evnt + " - " + JSON.stringify( args[0] ) );
		}
		else {
			console.log( "Socket FSM: " + evnt + " - " + JSON.stringify( args ) );
		}
	} );

	// every RemoteClientProxy gets a private subscription that can talk to the client
	// apart from any application-level channels.  This is a "utility" conduit.
	fsm.subscriptions._direct = {
		_private : postal.subscribe( {
			channel : socketClient.id,
			topic : "*",
			callback : function ( d, e ) {
				fsm.handle( "socketTransmit", d, e );
			}
		} )
	};

	// we explicitly start the FSM now that we've wired everything up, etc.
	fsm.transition( "connecting" );
	return fsm;
};

var PostalSocketHost = function ( postal, socketProvider ) {
	var self = this;

	// if enableMigration === true, then clients are allowed to migrate
	// from an older session id to a new one.  This can happen when the
	// client's connection is lost, but the old session id is kept around
	// in memory or local storage, etc.  When the client reconnects, it
	// will transmit the current and previous (if applicable) session ids.
	// If this is set to true, then the migration will take place - which
	// includes transferring existing subscriptions, as well as the delivery
	// of messages sent to the old session id proxy after the client lost
	// connection.
	self.enableMigration = true;


	self.channel = postal.channel( "postal.socket", "client.connect" );

	// array of clients - confirmed or not
	self.clients = [];

	// once a client has been marked as "identified", they are added to
	// this object, with the session id as the key.
	self.clientMap = {};

	// how to clean up a client
	self.removeClient = function ( id ) {
		if ( self.clientMap[ id ] ) {
			_.each( self.clientMap[ id ].subscriptions, function ( channel ) {
				_.each( channel, function ( sub ) {
					console.log( "unsubscribing: " + sub.channel + " - " + sub.topic );
					sub.unsubscribe();
				} );
			} );
			delete self.clientMap[ id ];
		}
		self.clients = _.filter( self.clients, function ( item ) {
			return item.sessionId !== id;
		} );
	};


	self.provider = socketProvider;

	// when our provider indicates a new socket has connected, we pass
	// the socket wrapper to an fsm (RemoteClientProxy) to be managed by it.
	self.provider.on( "connect", function ( socket ) {
		self.clients.push( new RemoteClientProxy( postal, socket, self ) );
	} );

	// when a client disconnects, if enableMigration is true, we don't delete
	// the old session until it has been used in a migration
	self.channel.subscribe( "client.disconnect", function ( data, envelope ) {
		if ( !self.enableMigration ) {
			self.removeClient( data.sessionId );
		}
	} );

	// if a session has been used in a migration and is no longer needed, remove it
	self.channel.subscribe( "client.migrated", function ( data, envelope ) {
		self.removeClient( data.lastSessionId );
	} );
};

module.exports = PostalSocketHost;