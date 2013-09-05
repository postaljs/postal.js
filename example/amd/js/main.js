require.config( {
	paths : {
		underscore  : "libs/underscore/underscore-min",
		postal      : "libs/postal/postal",
		postaldiags : "libs/postal/postal.diagnostics",
		jquery      : "libs/jquery/jquery-min"
	}
} );

require( [ "jquery" ], function ( $ ) {
	$( function () {
		require( [ "examples" ] );
	} );
} );