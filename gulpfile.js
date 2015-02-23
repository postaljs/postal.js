var gulp = require( "gulp" );
var fileImports = require( "gulp-imports" );
var header = require( "gulp-header" );
var beautify = require( "gulp-beautify" );
var hintNot = require( "gulp-hint-not" );
var uglify = require( "gulp-uglify" );
var rename = require( "gulp-rename" );
var plato = require( "gulp-plato" );
var gutil = require( "gulp-util" );
var express = require( "express" );
var path = require( "path" );
var pkg = require( "./package.json" );
var open = require( "open" ); //jshint ignore:line
var port = 3080;
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

var banner = [ "/**",
	" * <%= pkg.name %> - <%= pkg.description %>",
	" * Author: <%= pkg.author %>",
	" * Version: v<%= pkg.version %>",
	" * Url: <%= pkg.homepage %>",
	" * License(s): <% pkg.licenses.forEach(function( license, idx ){ %><%= license.type %><% if(idx !== pkg.licenses.length-1) { %>, <% } %><% }); %>",
	" */",
	""
].join( "\n" );

gulp.task( "combine", [ "combine.postal" ] );

gulp.task( "combine.postal", function() {
	return gulp.src( [ "./src/postal.js" ] )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( fileImports() )
		.pipe( hintNot() )
		.pipe( beautify( {
			indentSize: 4,
			preserveNewlines: false
		} ) )
		.pipe( gulp.dest( "./lib/" ) )
		.pipe( uglify( {
			compress: {
				negate_iife: false //jshint ignore:line
			}
		} ) )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( rename( "postal.min.js" ) )
		.pipe( gulp.dest( "./lib/" ) );
} );

gulp.task( "combine.postal-lodash", function() {
	return gulp.src( [ "./src/postal.lodash.js" ] )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( fileImports() )
		.pipe( hintNot() )
		.pipe( beautify( {
			indentSize: 4,
			preserveNewlines: false
		} ) )
		.pipe( gulp.dest( "./lib/" ) )
		.pipe( uglify( {
			compress: {
				negate_iife: false //jshint ignore:line
			}
		} ) )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( rename( "postal.lodash.min.js" ) )
		.pipe( gulp.dest( "./lib/" ) );
} );

gulp.task( "default", [ "combine", "combine.postal-lodash" ] );

var mocha = require( "gulp-spawn-mocha" );
gulp.task( "mocha", function() {
	return gulp.src( [ "spec/**/*.spec.js" ], { read: false } )
		.pipe( mocha( {
			require: [ "spec/helpers/node-setup.js" ],
			reporter: "spec",
			colors: true,
			inlineDiffs: true,
			debug: false
		} ) )
		.on( "error", console.warn.bind( console ) );
} );

gulp.task( "mocha-lodash", function() {
	return gulp.src( [ "spec/**/*.spec.js" ], { read: false } )
		.pipe( mocha( {
			require: [ "spec/helpers/node-lodash-build-setup.js" ],
			reporter: "spec",
			colors: true,
			inlineDiffs: true,
			debug: false
		} ) )
		.on( "error", console.warn.bind( console ) );
} );

gulp.task( "report", function() {
	return gulp.src( "./lib/postal.js" )
		.pipe( plato( "report" ) );
} );

var createServer = function( port ) {
	var p = path.resolve( "./" );
	var app = express();
	app.use( express.static( p ) );
	app.listen( port, function() {
		gutil.log( "Listening on", port );
	} );

	return {
		app: app
	};
};

var servers;

gulp.task( "server", [ "combine" ], function() {
	if ( !servers ) {
		servers = createServer( port );
	}
	open( "http://localhost:" + port + "/index.html" );
} );

gulp.task( "watch", [ "default", "mocha" ], function() {
	gulp.watch( "src/**/*", [ "default" ] );
	gulp.watch( "{lib,spec}/**/*", [ "mocha" ] );
} );

gulp.task( "browserify.postal-lodash", [ "combine.postal-lodash" ], function() {
	var bundler = browserify( {
		entries: [ './lib/postal.lodash.js' ],
		debug: false
	} );

	bundler.plugin( "bundle-collapser/plugin" );

	return bundler
		.bundle()
		.pipe( source( 'postal.lodash.bundle.js' ) )
		.pipe( buffer() )
		.pipe( gulp.dest( './lib/' ) )
		.pipe( uglify( {
			compress: {
				negate_iife: false //jshint ignore:line
			}
		} ) )
		.pipe( rename( 'postal.lodash.bundle.min.js' ) )
		.pipe( gulp.dest( './lib/' ) );

} );
