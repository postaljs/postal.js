var socket;

require.config( {
	paths : {
		'text' : 'lib/requirejs-text-1.0.2',
		'backbone' : 'lib/backbone',
		'underscore' : 'lib/underscore',
		'machina' : 'lib/machina',
		'postal' : 'lib/postal',
		'amplify' : 'lib/amplify',
		'bus' : 'infrastructure/bus'
	},
	baseUrl : 'js'
} );

require( [ 'backbone', 'jquery', 'underscore', 'amplify', 'machina', 'postal', 'lib/postal.diagnostics', 'infrastructure/postal.socket-client' ],
	function ( Backbone, $, _, amplify, machina, postal ) {

		// Customizing Postal with some experimental functionality....
		var sessionInfo = {};

		postal.configuration.getSessionIdAction = function ( callback ) {
			callback( sessionInfo );
		};
		postal.configuration.setSessionIdAction = function ( info, callback ) {
			sessionInfo = info;
			callback( sessionInfo );
		};
		postal.utils.getSessionId = function ( callback ) {
			postal.configuration.getSessionIdAction.call( this, callback );
		};

		postal.utils.setSessionId = function ( value, callback ) {
			postal.utils.getSessionId( function ( info ) {
				// get the session info to move id to last id
				info.lastId = info.id;
				info.id = value;
				// invoke the callback the user provided to handle storing session
				postal.configuration.setSessionIdAction( info, function ( session ) {
					callback( session );
					// publish postal event msg about the change
					postal.publish( {
						channel : postal.configuration.SYSTEM_CHANNEL,
						topic : "sessionId.changed",
						data : session
					} );
				} );
			} );
		};

		// for debugging purposes ONLY for now:
		window.postal = postal;

		require( [ 'infrastructure/app' ], function ( app ) {
			window.app = app;
		} );

	} );
