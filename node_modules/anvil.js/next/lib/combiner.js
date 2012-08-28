var combinerFactory = function( _, fp, scheduler ) {
	
	var Combiner = function( findPatterns, replacePatterns ) {
		this.findPatterns = findPatterns;
		this.replacePatterns = replacePatterns;
		_.bindAll( this );
	};

	Combiner.prototype.combine = function( file, onComplete ) {
		var self = this,
			steps = [],
			imported;

		if( !file.combined && file.imports.length > 0 ) {
			for( imported in file.imports ) {
				steps.push( this.getStep( imported ) );
			}
			fp.read( [ file.workingPath, file.name ], function( main ) {
				scheduler.pipeline( main, steps, function( result ) {
					fp.write( [ file.workingPath, file.name ], result, onComplete );
				} );
			} );
		} else {
			onComplete();
		}
	};

	Combiner.prototype.combineFile = function( file, onComplete ) {
		var self = this,
			dependencies = file.imports,
			done = function() {
				file.combined = true;
				onComplete();
			},
			combine = function() {
				self.combine( file, done );
			};

		if( file.combined ) {
			onComplete();
		} else if( dependencies && dependencies.length > 0 ) {
			scheduler.parallel( dependencies, this.combineFile, combine );
		} else {
			combine();
		}
	};

	Combiner.prototype.combineList = function( list, onComplete ) {
		var self = this,
			findImports = function( file, done ) {
				self.findImports( file, list, done );
			},
			onImports = function() {
				self.onImports( list, onComplete );
			};

		scheduler.parallel( list, findImports, onImports );
	};

	Combiner.prototype.findDependents = function( file, list ) {
		var imported = function( importFile ) { return file.name === importFile.name; },
			item;
		for( item in list ) {
			if( _.any( item.imports, imported ) ) {
				file.dependents++;
			}
		}
	};

	Combiner.prototype.findImports = function( file, list, onComplete ) {
		var self = this,
			imports = [];

		fp.read( [file.workingPath, file.name ], function( content ) {
			var pattern, imported, importName;

			for( pattern in self.findPatterns ) {
				imports = imports.concat( content.match( pattern ) );
			}
			imports = _.filter( imports, function( x ) { return x; } );

			for( imported in imports ) {
				importName = imported.match( /['\"].*['\"]/ )[ 0 ].replace( /['\"]/g, "" );
				importedFile = _.find( list, function( i ) { return i.name == importName; } );
				file.imports.push( importedFile );
			}
			onComplete();
		} );
	};

	Combiner.prototype.getStep = function( imported ) {
		var self = this;
		return function( text, done ) {
			self.replace( text, imported, done );
		};
	};

	Combiner.prototype.onImports = function( list, onComplete ) {
		var findDependents =  _.bind( function( file, done ) {
				self.findDependents( file, list, done );
			} ),
			file;

		for( file in list ) {
			findDependents( file, list );
		}
		scheduler.parallel( list, this.combineFile, onComplete );
	};

	Combiner.prototype.replace = function( content, imported, onComplete ) {
		var self = this,
			source = imported.name,
			working = imported.workingPath;

		fp.read( [ working, source ], function( newContent ) {
			var steps = [],
				pattern;

			for( pattern in self.replacePatterns ) {
				steps.push( function( current, done ) {
					var stringified = pattern.toString().replace( /replace/, source ),
						trimmed = stringified.substring( 1, stringified.length - 2 ),
						newPattern = new RegExp( trimmed, "g" ),
						capture = newPattern.exec( content ),
						whiteSpace;

						if( capture && capture.length > 1 ) {
							whiteSpace = capture[1];
							newContent = whiteSpace + newContent.replace( /\n/g, "\n" + whiteSpace );
						}
						done( current.replace( newPattern, newContent ) );
				} );
				scheduler.pipeline( content, steps, onComplete );
			}
		} );
	};

	return Combiner;
};

module.exports = combinerFactory;