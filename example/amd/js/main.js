require.config( {
	paths : {
		underscore  : "../../../bower/underscore/underscore-min",
		postal      : "../../../lib/postal",
		postaldiags : "../../../bower/postal.diagnostics/lib/postal.diagnostics",
		jquery      : "../../../bower/jquery/jquery.min"
	},
    shim : {
        underscore: {
            exports: "_"
        }
    }
} );

require( [ "jquery" ], function ( $ ) {
	$( function () {
		require( [ "examples" ] );
	} );
} );