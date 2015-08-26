var gulp = require( "gulp" );
var fileImports = require( "gulp-imports" );
var header = require( "gulp-header" );
var uglify = require( "gulp-uglify" );
var rename = require( "gulp-rename" );
var plato = require( "gulp-plato" );
var gutil = require( "gulp-util" );
var express = require( "express" );
var path = require( "path" );
var pkg = require( "./package.json" );
var open = require( "open" ); //jshint ignore:line
var port = 3080;
var jshint = require( "gulp-jshint" );
var jscs = require( "gulp-jscs" );
var gulpChanged = require( "gulp-changed" );
var replace = require( "gulp-replace" );
var replaceTargets = [
	"([\\/][\\*][\\s]*jshint\\s.+[\\*\\/])",
	"([\\/][\\*][\\s]*global\\s.+[\\*\\/])",
	"([\\/][\\*][\\s]*jscs:\\s.+[\\*\\/])",
	"([\\/][\\*][\\s]*istanbul\\s.+[\\*\\/])",
	"(\\/\\/[\\s]*jshint.*)",
	"(\\/\\/[\\s]*jscs:.*)",
	"(\\/\\/[\\s]*istanbul.*)"
];

var banner = [ "/**",
	" * <%= pkg.name %> - <%= pkg.description %>",
	" * Author: <%= pkg.author %>",
	" * Version: v<%= pkg.version %>",
	" * Url: <%= pkg.homepage %>",
	" * License(s): <% pkg.licenses.forEach(function( license, idx ){ %><%= license.type %><% if(idx !== pkg.licenses.length-1) { %>, <% } %><% }); %>",
	" */",
	""
].join( "\n" );

gulp.task( "combine", [ "combine.postal", "combine.postal-lodash" ] );

gulp.task( "combine.postal", [ "format-src" ], function() {
	return gulp.src( [ "./src/postal.js" ] )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( fileImports() )
		.pipe( replace( new RegExp( replaceTargets.join( "|" ),"gi" ), "" ) )
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

gulp.task( "combine.postal-lodash", [ "format-src" ], function() {
	return gulp.src( [ "./src/postal.lodash.js" ] )
		.pipe( header( banner, {
			pkg: pkg
		} ) )
		.pipe( fileImports() )
		.pipe( replace( new RegExp( replaceTargets.join( "|" ),"gi" ), "" ) )
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

gulp.task( "default", [ "format-lib" ] );

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

gulp.task( "jshint", function() {
	return gulp.src( [ "src/**/*.js", "spec/**/*.js" ] )
		.pipe( jshint() )
		.pipe( jshint.reporter( "jshint-stylish" ) )
		.pipe( jshint.reporter( "fail" ) );
} );

gulp.task( "format-lib", [ "combine" ], function() {
	return gulp.src( [ "./lib/postal.js", "./lib/postal.lodash.js" ] )
		.pipe( jscs( {
			configPath: ".jscsrc",
			fix: true
		} ) )
		.pipe( gulp.dest( "./lib" ) );
} );

gulp.task( "format-src", [ "jshint" ], function() {
	return gulp.src( [ "./src/**/*.js", "!node_modules/**" ] )
		.pipe( jscs( {
			configPath: ".jscsrc",
			fix: true
		} ) )
		.pipe( gulpChanged( "./src", { hasChanged: gulpChanged.compareSha1Digest } ) )
		.pipe( gulp.dest( "./src" ) );
} );
