var logFactory = function( options ) {
	return {
		onDebug: function( x ) {
			if( options.debug ) {
				console.log( x.purple );
			}
		},
		onEvent: function( x ) {
			if( !options.quiet ) {
				console.log( "\t" + x );
			}
		},
		onStep: function( x ) {
			if( !options.quiet ) {
				console.log( x.blue );
			}
		},
		onComplete: function( x ) {
			console.log( x.green );
		},
		onWarning: function( x ) {
			if( !options.quiet ) {
				console.log( x.orange );
			}
		},
		onError: function( x ) {
			console.log( ("\t" + x).red );
		}
	};
};

module.exports = logFactory;