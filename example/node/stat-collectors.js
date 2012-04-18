var fs = require( 'fs' ),
	path = require( 'path' ),
	Adapter = require( './messaging/collector-adapter.js'),
	collectorPath = './collectors';

module.exports = {
	load: function ( searchChannel, statsChannel ) {
		return fs.readdirSync( collectorPath ).reduce( function ( accum, collector ) {
			try {
				var instance = new ( require( path.join( path.resolve( collectorPath ), collector ) ) )(collector.replace(/.js\b/, ""));
				accum[ collector ] = new Adapter( instance, searchChannel, statsChannel );
			}
			catch ( ex ) {
				console.log( "Unable to load '" + collector + "' - " + ex );
			}
			return accum;
		}, {});
	}
};