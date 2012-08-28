var crawlerFactory = function( _, fs, path, scheduler ) {

	var Crawler = function( ) {
		_.bindAll( this );
	};

	Crawler.prototype.crawl = function( directory, onComplete ) {
		var self = this,
			fileList = [],
			onContents = function( error, contents ) {
				self.onContents( error, contents, fileList, onComplete );
			};

		if( directory && directory !== "" ) {
			directory = path.resolve( directory );
			fs.readdir( directory, onContents );
		} else {
			onComplete( fileList );
		}
	};

	Crawler.prototype.classifyHandle = function( file, onComplete ) {
		fs.stat( file, function( err, stat ) {
			if( err ) {
				onComplete( { file: file, err: err } );
			} else {
				onComplete( { file: file, isDirectory: stat.isDirectory() } );
			}
		} );
	};

	Crawler.prototype.classifyHandles = function( list, onComplete ) {
		var self = this;
		if( list && list.length > 0 ) {
			scheduler.parallel( list, this.classifyHandle, function( classified ) {
				self.onClassified( classified, onComplete );
			} );
		} else {
			onComplete( [], [] );
		}
	};

	Crawler.prototype.onClassified = function( classified, onComplete ) {
		var files = [], 
			directories = [],
			item;

		for( item in classified ) {
			if( item.isDirectory ) {
				directories.push( item.file );
			} else if( !item.error ) {
				files.push( item.file );
			}
		}
		onComplete( files, directories );
	};

	Crawler.prototype.onContents = function( error, contents, fileList, onComplete ) {
		var self = this,
			qualified =[],
			onQualified = function( files, directories ) {
				self.onQualified( files, directories, fileList, onComplete );
			},
			item;

		if( !err && contents.length > 0 ) {
			for( item in contents ) {
				qualified.push( path.resolve( directory, item ) );
			}
			this.classifyHandles( qualified, onQualified );
		} else {
			onComplete( fileList );
		}
	};

	Crawler.prototype.onQualified = function( files, directories, fileList, onComplete ) {
		fileList = fileList.concat( files );
		if( directories.length > 0 ) {
			scheduler.parallel( directories, this.crawl, function( files ) {
				fileList = fileList.concat( _.flatten( files ) );
				onComplete( fileList );
			} );
		} else {
			onComplete( fileList );
		}
	};

	return Crawler;
};

module.exports = crawlerFactory;