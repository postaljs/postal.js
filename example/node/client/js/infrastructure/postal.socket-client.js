/*
    postal.socket
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.1.0
*/

(function( root, doc, factory ) {
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( [ "underscore", "machina", "postal" ], function( _, machina, postal ) {
			return factory( _, machina, postal, root, doc );
		});
	} else {
		// Browser globals
		factory( root._, root.machina, root.postal, root, doc );
	}
}(this, document, function( _, machina, postal, global, document, undefined ) {

	/*
		adding a socket namespace to postal
		which provides the following members:
	    1.) config - provides values used to manage the socket connection
	    2.) goOffline() - tells the manager to close the connection intentionally
	    3.) goOnline() - tells the manager to try to connect.
	    4.) manifest - an array of objects describing the subscriptions that have been
	        set up on the remote end.
	    5.) publish() - takes a valid postal envelope and pushes it through the socket
	        to be published to the server instance of postal.
	    6.) socketMgr - the FSM managing the socket connection
		7.) socketNamespace - exposed currently for debugging only
		8.) subscribe() - passes an object through the socket to the server
			which contains data necessary to set up a remote subscription.  The
			options passed to the socket would look similar to this:
	            {
	                "channel":"SomeChannel",
	                "topic":"my.topic",
	                "correlationId":"2073383865318591267"
	            }
	        The "correlationId" is used on the remote side to apply a constraint to
	        the subscription, enabling just this specific client to be targeted on
	        and otherwise public channel.
	    9.) unsubscribe() - passes an object through the socket to the server
	        which contains data necessary to remove a remote subscription.  The options
	        passed would look similar to the example above in #8.
	 */
	postal.connections = postal.connections || {};
	
	var postalSocket = postal.connections.socket = (function(){
		var socketNamespace,
			fsm = new machina.Fsm({
				retryFn: undefined,
	
				session: undefined,
	
				wireUpSocketEvents: function() {
					var self = this;
					_.each([ "connect", "connecting", "connect_failed", "disconnect", "reconnect", "reconnect_failed",
							 "reconnecting", "postal.socket.remote", "postal.socket.identified", "postal.socket.migration" ],
						function( evnt ) {
							socketNamespace.on( evnt, function( data ) {
								self.handle( evnt, data );
							});
						});
				},
	
				states: {
					uninitialized: {
						tryConnect: function() {
							this.transition("initializing");
						}
					},
					initializing: {
						_onEnter: function() {
							socketNamespace = io.connect(postalSocket.config.url, { "auto connect": false });
							this.wireUpSocketEvents();
							this.transition("probing")
						},
						socketTransmit: function() {
							this.deferUntilTransition("online");
						}
					},
					probing: {
						_onEnter: function() {
							clearTimeout(this.retryFn);
							if(!socketNamespace.socket.connecting && !socketNamespace.socket.reconnecting) {
								socketNamespace.socket.connect();
							}
							else {
								this.transition("settingSessionInfo");
							}
						},
						connect: function(){
							this.transition("settingSessionInfo");
						},
						connect_failed: function() {
							this.transition("disconnected");
						},
						maxAttempts: function() {
							this.transition("offline");
						},
						"postal.socket.remote" : function() {
							this.deferUntilTransition("online");
						},
						reconnect: function(){
							this.transition("settingSessionInfo");
						},
						reconnect_failed: function() {
							this.transition("disconnected");
						},
						socketTransmit: function() {
							this.deferUntilTransition("online");
						}
					},
					settingSessionInfo: {
						_onEnter: function() {
							var self = this;
							postal.utils.getSessionId( function( session ) {
								if( !session || !session.id ) {
									self.handle("useFallbackSessionId" );
								} else {
									self.session = session;
									self.transition("identifying");
								}
							});
						},
						useFallbackSessionId : function () {
							var self = this;
							postal.utils.setSessionId( socketNamespace.socket.sessionid , function( session ) {
								self.session = session;
								self.transition("identifying");
							});
						}
					},
					identifying: {
						_onEnter: function() {
							var self = this;
							self.retryFn = setTimeout(function() {
								self.handle( "timeout.identifying" );
							},postalSocket.config.reconnectInterval );
							self.handle( "client.identifier" );
						},
						"client.identifier" : function() {
							clearTimeout( this.retryFn );
							socketNamespace.emit( "postal.clientId", { sessionId: this.session.id, lastSessionId: this.session.lastId } );
						},
						"postal.session.changed" : function() {
							socketNamespace.socket.disconnect();
						},
						connect_failed: function() {
							this.transition("disconnected");
						},
						disconnect: function() {
							this.transition("probing");
						},
						"postal.socket.identified" : function( data ) {
							this.transition("online");
						},
						"postal.socket.migration" : function() {
							_.each(postal.socket.manifest, function( sub ) {
								fsm.handle( "socketTransmit", "postal.subscribe", sub );
							});
							socketNamespace.emit( "postal.migrationComplete", {} );
						},
						"postal.socket.remote" : function() {
							this.deferUntilTransition("online");
						},
						reconnect_failed: function() {
							this.transition("disconnected");
						},
						socketTransmit: function( evntName, envelope ) {
							if( evntName === "postal.subscribe" ){
								// we risk mutating the message here, so extend
								// and add the correlationId to the extended copy
								var socketEnv = _.extend( {}, envelope );
								socketEnv.correlationId = this.session.id;
								socketNamespace.emit(evntName, socketEnv);
							}
							else {
								this.deferUntilTransition("online");
							}
						},
						"timeout.identifying" : function() {
							this.transition("probing");
						}
					},
					online: {
						disconnect: function() {
							this.transition("probing");
						},
						"postal.session.changed" : function() {
							socketNamespace.socket.disconnect();
						},
						goOffline: function() {
							this.transition("offline");
						},
						"postal.socket.remote" : function( envelope ) {
							postal.publish( envelope );
						},
						socketTransmit: function( evntName, envelope ) {
							// we risk mutating the message here, so extend
							// and add the correlationId to the extended copy
							var socketEnv = _.extend( {}, envelope );
							socketEnv.correlationId = this.session.id;
							socketNamespace.emit(evntName, socketEnv);
						}
					},
					offline: {
						_onEnter: function() {
							socketNamespace.socket.disconnect();
						},
						socketTransmit: function() {
							this.deferUntilTransition("online");
						},
						"tryConnect": function() {
							this.transition("probing");
						}
					},
					disconnected: {
						_onEnter: function() {
							var self = this;
							self.retryFn = setTimeout(function() {
								self.transition("probing");
							},postalSocket.config.reconnectInterval);
						},
						connecting: function() {
							this.transition("probing");
						},
						reconnecting: function() {
							this.transition("probing");
						},
						socketTransmit: function() {
							this.deferUntilTransition("online");
						}
					}
				}
			});
		postal.subscribe({
			channel: "postal",
			topic: "sessionId.changed",
			callback: function() {
				fsm.handle("postal.session.changed");
			}
		});
		return {
			config : {
				url: window.location.origin,
				reconnectInterval: 4000
			},
			goOffline: function() {
				fsm.handle( "goOffline" );
			},
			goOnline: function() {
				fsm.handle( "tryConnect" );
			},
			manifest: [],
			publish: function( envelope ) {
				fsm.handle( "socketTransmit", "postal.publish", envelope );
			},
			subscribe: function( options ) {
				options.channel = options.channel || postal.configuration.DEFAULT_CHANNEL;
				options.topic = options.topic || "*";
				if( !_.any( this.manifest, function( item ){
					return item.channel === options.channel && item.topic === options.topic;
				})) {
					this.manifest.push( options );
					fsm.handle( "socketTransmit", "postal.subscribe", options );
				}
			},
			socketMgr: fsm,
			socketNamespace: socketNamespace,
			unsubscribe: function( options ) {
				options.channel = options.channel || postal.configuration.DEFAULT_CHANNEL;
				options.topic = options.topic || "*";
				if( !postal.getSubscribersFor( options.channel, options.topic ).length ) {
					fsm.handle( "socketTransmit", "postal.unsubscribe", options);
				}
			}
		}
	})();
	
	postal.connections.socket.goOnline();
	var SocketChannel = postal.channelTypes.websocket = function( channelName, defaultTopic ) {
		var channel = postal.channel( channelName, defaultTopic ),
			localSubscribe = channel.subscribe,
			localPublish = channel.publish,
			localTopic = channel.topic;
	
		channel.publish = function() {
			postalSocket.publish( localPublish.apply( channel, arguments) );
		};
	
		channel.subscribe = function() {
			var sub = localSubscribe.apply( channel, arguments),
				origUnsubscribe;
			origUnsubscribe = sub.unsubscribe;
			sub.unsubscribe = function() {
				origUnsubscribe.call(sub);
				postalSocket.unsubscribe({ channel: sub.channel, topic: sub.topic });
			};
			postalSocket.subscribe({ channel: sub.channel, topic: sub.topic });
			return sub;
		};
	
		channel.topic = function( topic ) {
			if(topic === channel._topic) {
				return this;
			}
			return new SocketChannel(this.channel, topic);
		};
	
		return channel;
	};

}));