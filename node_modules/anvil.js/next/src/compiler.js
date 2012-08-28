var compilerFactory = function( _, fp, log ) {

	var Compiler = function(  ) {
		this.extensionMap = {};
		this.compilers = {};
	};

	Compiler.prototype.registerCompiler = function( fromExt, toExt, compile ) {
		this.extensionMap[ fromExt ] = toExt;
		this.compilers[ fromExt ] = compile;
	};

	Compiler.prototype.compile = function( file, onComplete ) {
		var ext = file.ext(),
			newExt = this.extensionMap[ ext ],
			newFile = file.name.replace( ext, newExt ),
			compiler = this.compilers[ ext ];

		if( compiler && newExt ) {
			log.onDebug( "Compiling " + file.name + " to " + newFile );
			fp.transform(
				[ file.workingPath, file.name ],
				compiler,
				[ file.workingPath, newFile ],
				function( err ) {
					if( !err ) {
						file.name = newFile;
						onComplete( file );
					} else {
						log.onError( "Error compiling " + file.name + ": \r\n " + err );
						onComplete( file, err );
					}
				} );
		} else {
			log.onWarning( "No compilers registered for files of type " + ext );
			onComplete( file );
		}
	};

	return Compiler;
};

module.exports = compilerFactory;
