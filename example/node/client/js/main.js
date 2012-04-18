var socket;

require.config( {
	paths  : {
		'text'      : 'lib/requirejs-text-1.0.2',
		'backbone'  : 'lib/backbone',
		'underscore': 'lib/underscore',
		'machina'   : 'lib/machina',
		'postal'    : 'lib/postal',
		'amplify'   : 'lib/amplify',
		'bus'       : 'infrastructure/bus'
	},
	baseUrl: 'js'
} );

require( [ 'backbone', 'jquery', 'underscore', 'machina', 'postal', 'lib/postal.diagnostics', 'infrastructure/postal.socket-client' ],
	function( Backbone, $, _, machina, postal ){

		// for debugging purposes ONLY for now:
		window.postal = postal;

		postal.addWireTap( function( d, e ){
			if( e.topic === "search.info" ) {
				console.log( JSON.stringify( e ) );
			}
		});

		postal.connections.socket.socketMgr.on( "*", function( evnt, data ){
			var args = [].slice.call( arguments,1 );
			if( args[0] === "postal.remote" ) {
				//console.log( "FSM Event: " + evnt + " - " + JSON.stringify( args[0] ) );
			}
			else {
				//console.log( "FSM Event: " + evnt + " - " + JSON.stringify( args ) );
			}
		});

		require([ 'infrastructure/app' ], function( app ) {
			window.app = app;
		});

});
