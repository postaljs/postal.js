var _ = require("underscore"),
	express = require( 'express' ),
	app = express.createServer(),
	postal = require( "./messaging/postal.js" ),
	PostalSocketHost = require( './messaging/postal.socket-host.js' ),
	sockets = require( './messaging/socket-io-provider.js' ),
	TwitterSearch = require( './twitter-search.js' ),
	collectors = require( './stat-collectors.js' ),
	BusAdapter = require( './messaging/bus-adapter.js' ),
	machina = require( './machina.js' );

postal.addWireTap( function( data, envelope ){
	if( envelope.channel === "stats" /*|| envelope.channel === "twittersearch"*/ ) {
		var env = _.extend( {}, envelope );
		delete env.data;
		console.log( JSON.stringify( env ) );
	}
	else if (_.include(["postal.socket", "postal", "app", "app.events"], envelope.channel) ) {
		console.log( JSON.stringify( envelope ) );
	}
});

// wire machina FSMs into postal automagically
require( './messaging/machina.postal.js' )( postal, machina );

var TwitterSocketStats = function( port, refreshinterval ) {
	// Stand up our express app
	app.use( "/", express.static( __dirname + '/client' ) );
	app.listen( port );
	var searchChannel = postal.channel( "twittersearch", "*" ),
		statsChannel = postal.channel( "stats", "*" ),
		appChannel = postal.channel( "statsApp", "*" );

	postal.linkChannels( { channel: "postal.socket", topic: "client.migrated"}, { channel: "statsApp", topic: "client.migrated" } );

	return new machina.Fsm({

		namespace: "statsApp",

		currentSearch: {
			id: null,
			searchTerm: "{ Search Not Active }"
		},

		searchRequests: {},

		express: app,

		appChannel: appChannel,

		searchChannel: searchChannel,

		statsChannel: statsChannel,

		searchAgent: new BusAdapter(new TwitterSearch( refreshinterval), searchChannel, searchChannel ),

		stats: collectors.load( searchChannel, statsChannel ),

		postal: postal,

		bridge: new PostalSocketHost( postal, sockets.getSocketProvider( postal, app ) ),

		getAvailableStats: function( clientId ) {
			this.appChannel.publish({
				topic: "available.topics",
				correlationId: clientId,
				data: {
					topics:_.toArray(this.stats).map(function(stat) { return { channel: "stats", topic: stat.namespace }; })
				}
			});
		},

		setSearch: function( correlationId, searchTerm ) {
			this.currentSearch = {
				id: correlationId,
				searchTerm: searchTerm
			};
			this.searchAgent.search(searchTerm);
			this.appChannel.publish({
				topic: "search.info",
				data: this.currentSearch
			});
		},

		getSearchInfo: function( env ) {
			this.appChannel.publish({
				topic: "search.info",
				correlationId: env.correlationId,
				data: this.currentSearch
			});
		},

		states: {
			uninitialized: {
				start: function() {
					this.transition("notSearching");
				},
				"*" : function() {
					this.deferUntilTransition();
				}
			},
			notSearching: {
				"search.new.request" : function( data, envelope ) {
					this.setSearch( envelope.correlationId, data.searchTerm );
					this.transition("searching");
				},
				"get.search.info": function( data, env ) {
					this.getSearchInfo( env );
				},
				"get.available" : function( data, envelope ) {
					this.getAvailableStats( envelope.correlationId );
				}
			},
			searching: {
				"search.new.request" : function( data, envelope ) {
					if(envelope.correlationId === this.currentSearch.id) {
						this.setSearch( envelope.correlationId, data.searchTerm );
					}
					else {
						this.appChannel.publish({
							topic: "search.new.ask",
							data: {
								correlationId: this.currentSearch.id,
								searchTerm: data.searchTerm
							}
						});
					}
				},
				"search.new.confirm" : function( data, envelope ) {
					if( envelope.correlationId === this.currentSearch.id ) {
						this.setSearch( data.correlationId, data.searchTerm );
					}
				},
				"get.search.info": function( data, env ) {
					this.getSearchInfo( env );
				},
				"get.available" : function( data, envelope ) {
					this.getAvailableStats( envelope.correlationId );
				},
				"client.migrated" : function( data, envelope ) {
					if( data.lastSessionId === this.currentSearch.id ) {
						this.currentSearch.id = data.sessionId;
					}
				}
			}
		}
	});
};

var x = module.exports = new TwitterSocketStats( 8002, 7000 );

x.on("*", function(evnt, data){
	console.log("FSM Event: " + evnt + " - " + JSON.stringify([].slice.call(arguments,1)));
});

x.handle("start");
