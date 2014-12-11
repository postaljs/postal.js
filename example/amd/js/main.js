require.config( {
	paths: {
		lodash: "../../../bower/lodash/dist/lodash",
		postal: "../../../lib/postal",
		postaldiags: "../../../bower/postal.diagnostics/lib/postal.diagnostics",
		jquery: "../../../bower/jquery/jquery.min",
		conduitjs: "../../../bower/conduitjs/lib/conduit.min"
	}
} );

require( [ "jquery" ], function( $ ) {
	$( function() {
		require( [ "examples" ] );
	} );
} );
