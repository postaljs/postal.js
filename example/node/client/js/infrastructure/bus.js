define( [
	'postal'
], function ( postal ) {
	return {
		router : postal.channel( "router", "*" ),
		viewManager : postal.channel( "viewmanager", "*" ),
		data : postal.channel( "data", "*" ),
		app : postal.channel( "statsApp", "*", { type : "websocket" } ),
		stats : postal.channel( "stats", "*", { type : "websocket" } )
	}
} );