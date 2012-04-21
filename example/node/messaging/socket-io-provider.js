var _ = require( 'underscore' ),
	EventEmitter = require( 'events' ).EventEmitter,
	util = require( 'util' );

module.exports = {
	getSocketProvider : function ( postal, app, options ) {
		/*
		 Socket client wrappers must provide the following:
		 1.) an "id" property which returns the session identifier for the connection
		 2.) EventEmitter's "on" method call (to subscribe callbacks to events)
		 3.) publish the following events (consumed by the postal socket host:
		 a.) disconnect - triggered when the socket disconnects.
		 b.) publish - triggered when the client at the other end of the socket
		 publishes a message.  The callback(s) for this event should receive
		 a valid postal.js message envelope, and should ideally include a
		 correlationId that matches the client wrapper id.
		 {
		 channel: "someChannel",
		 topic: "some.topic",
		 data: {
		 greeting: "Oh, hai!"
		 },
		 timeStamp: "2012-04-17T07:11:14.731Z",
		 correlationId: "195371348624696856"
		 }
		 c.) unsubscribe - triggered when the client at the other end of the socket
		 specified that they want to unsubscribe a server-side subscription tied
		 to the socket.  The callback(s) for this event should receive an object
		 that contains the channel name and topic to unsubscribe:
		 { channel: "someChannel", topic: "some.topic" }
		 d.) subscribe - triggered when the client at the other end of the socket
		 specifies that they want to subscribe on the server-side, and have messages
		 forwarded over the socket down the client.  The callback(s) for this event
		 should receive an object that contains the channel name and topic to which
		 the client wants to subscribe:
		 { channel: "someChannel", topic: "some.topic" }
		 e.) clientId - triggered when the client sends a message containing the current
		 and previous (if one exists) session id.  The callback(s) for this event
		 should receive an object similar to the following:
		 { sessionId: "5072013211555684761", lastSessionId: "15075244651115973710" }
		 f.) migrationComplete - triggered when the client is done migrating any state from
		 an old session id to the current one.  The callbacks do not need an arg provided.

		 */
		var SocketIoClient = function ( socket ) {
			var self = this;
			EventEmitter.call( self );

			self.socket = socket;
			Object.defineProperty( self, "id", {
				get : function () {
					return self.socket.id;
				},
				enumerable : true
			} );

			// wire up what to do when this socket disconnects
			self.socket.on( 'disconnect', function () {
				self.emit( "disconnect", self );
			} );

			// set up event hooks for postal specific events
			_.each( [ "publish", "unsubscribe", "subscribe", "clientId", "migrationComplete" ], function ( evnt ) {
				self.socket.on( "postal." + evnt, function ( data ) {
					self.emit( evnt, data );
				} );
			} );
		};

		util.inherits( SocketIoClient, EventEmitter );

		SocketIoClient.prototype.publish = function ( data, envelope ) {
			this.socket.emit( "postal.socket.remote", envelope );
		};
		SocketIoClient.prototype.confirmClientIdentified = function ( uid ) {
			this.socket.emit( "postal.socket.identified", { uid : uid } );
		};
		SocketIoClient.prototype.migrateClientSubscriptions = function () {
			this.socket.emit( "postal.socket.migration", {} );
		};

		/*
		 The Socket Provider is a wrapper around the framework being
		 used to provide websocket functionality to postal.socket.
		 The implementation below wraps socket.io.
		 */
		var SocketIoProvider = function ( webApp, opt ) {
			var opt = opt || {},
				io = require( 'socket.io' ).listen( webApp ),
				self = this;
			io.set( 'log level', opt.ioLogLevel || 1 );

			EventEmitter.call( self );

			self.events = {
				"connect" : []
			};

			// We listen for when socket.io detects a new socket connection.
			// Then we take that socket instance and wrap it in our SocketIoClient
			// wrapper.  The PostalSocketHost receives an instance of this
			// SocketIoProvider object and subscribes to the "connect" event.
			io.sockets.on( "connection", function ( socket ) {
				var _socket = new SocketIoClient( socket );
				self.emit( "connect", _socket );
			} );
		};

		util.inherits( SocketIoProvider, EventEmitter );

		return new SocketIoProvider( app, options );
	}
};