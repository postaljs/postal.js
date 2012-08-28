var fileBootstrapFactory = function( _, fp, scheduler, minimatch ) {
	
	var Bootstrapper = function( paths, inclusions, exclusions, callback ) {
		var map = {};
		this.inclusions = inclusions;
		this.exclusions = exclusions;
		this.callback = callback;
		_.bindAll( this );

		paths = _.isArray( paths ) ? paths : [ paths ];
		_.each( paths, function( p ) {
			map[ p ] = fp.getFiles;
		} );
		scheduler.mapped( map, this.onFiles );
	};

	Build.prototype.onFiles = function( fileLists ) {
		var included = [],
			exlcluded = [],
			list;
		_.each( this.inclusions, function( inclusion ) {
			included.push( fileLists.filter( minimatch.filter( inclusion ) ) );
		} );

		_.each( this.exclusions, function( exclusion ) {
			excluded.push( fileLists.filter( minimatch.filter( exclusion ) ) );
		} );
		
		list = _( included )
					.chain()
					.flatten()
					.uniq()
					.difference( excluded )
					.value();
		fileMap = {};
		_.each( list, function( path ) {
			fileMap[ path ] = this.createFileMachine;
		}, this );

		scheduler.mapped( fileMap, this.callback );
	};
};

module.exports = fileBootStrapFactory;