// This is the standard lib version of postal.diagnostics.js
// If you need the amd-module style version, go to http://github.com/ifandelse/postal.js
(function ( postal, _, undefined ) {

	var filters = [],
		applyFilter = function ( filter, env ) {
			var match = 0, possible = 0;
			_.each( filter, function ( item, key ) {
				if ( env[key] ) {
					possible++;
					if ( _.isRegExp( item ) && item.test( env[key] ) ) {
						match++;
					}
					else if ( _.isObject( env[key] ) && !_.isArray( env[key] ) ) {
						if ( applyFilter( item, env[key] ) ) {
							match++;
						}
					}
					else {
						if ( _.isEqual( env[key], item ) ) {
							match++;
						}
					}
				}
			} );
			return match === possible;
		};
	
	// this returns a callback that, if invoked, removes the wireTap
	var wireTap = postal.addWireTap( function ( data, envelope ) {
		if ( !filters.length || _.any( filters, function ( filter ) {
			return applyFilter( filter, envelope );
		} ) ) {
			if ( !JSON ) {
				throw "This browser or environment does not provide JSON support";
			}
			try {
				console.log( JSON.stringify( envelope ) );
			}
			catch ( exception ) {
				try {
					var env = _.extend( {}, envelope );
					delete env.data;
					console.log( JSON.stringify( env ) + "\n\t" + "JSON.stringify Error: " + exception.message );
				}
				catch ( ex ) {
					console.log( "Unable to parse data to JSON: " + exception );
				}
			}
		}
	} );
	
	postal.diagnostics = postal.diagnostics || {};
	
	postal.diagnostics.console = {
		clearFilters : function () {
			filters = [];
		},
		removeFilter : function ( filter ) {
			filters = _.filter( filters, function ( item ) {
				return !_.isEqual( item, filter );
			} );
		},
		addFilter : function ( constraint ) {
			if ( !_.isArray( constraint ) ) {
				constraint = [ constraint ];
			}
			_.each( constraint, function ( item ) {
				if ( filters.length === 0 || !_.any( filters, function ( filter ) {
					return _.isEqual( filter, item );
				} ) ) {
					filters.push( item );
				}
			} );
	
		},
		getCurrentFilters : function () {
			return filters;
		},
		removeWireTap : function () {
			if ( wireTap ) {
				wireTap();
			}
		}
	};
	
	

})( postal, _ );