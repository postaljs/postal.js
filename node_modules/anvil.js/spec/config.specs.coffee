_ = require "underscore"
log = require( "./logMock.coffee" ).log
FP = require( "./fsMock.coffee" ).fsProvider
Configuration = require( "../src/config").configuration
Scheduler = require( "../src/scheduler.coffee").scheduler
scheduler = new Scheduler()

require "should"

defaultSiteConfig =
	"source": "src"
	"style": "style"
	"markup": "markup"
	"output": 
		{
			"source": [ "lib", "site/js" ],
			"style": [ "css", "site/css" ],
			"markup": "site/"
		}
	"spec": "spec"
	"ext": "ext"
	"lint": {}
	"uglify": {}
	"cssmin": {}
	"hosts": {
	  "/": "site"
	}
	"working": "./tmp"

defaultLibConfig = 
	"source": "src"
	"output": "lib"
	"spec": "spec"
	"ext": "ext"
	"lint": {}
	"uglify": {}
	"hosts": {
	  "/": "spec"
	}
	"working": "./tmp"

class Anvil
	constructor: () ->
	build: () ->

describe "when building in lib without build file", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	it "should provide default lib configuration", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			defaultLibConfig.output = 
				"style": "lib"
				"source": "lib"
				"markup": "lib"
			_.isEqual( config, defaultLibConfig ).should.be.ok
			done()

describe "when building in site without build file", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	before ( done ) ->
		fp.ensurePath "./site", done

	it "should provide default site configuration", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			_.isEqual( config, defaultSiteConfig ).should.be.ok
			done()

describe "when using default build.json file", ->
	fp = new FP()

	build = 
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"finalize": {}
		"wrap": {}
			
	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, done

	cp = new Configuration fp, scheduler, log

	it "should use the loaded file", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			build.working = "./tmp"
			_.isEqual( config, build ).should.be.ok
			done()

describe "when specifying CI", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	it "should set continuous flag", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--ci" ], ( config ) ->
			config.continuous.should.be.ok
			done()

describe "when specifying hosting", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	it "should set host flag", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--host" ], ( config ) ->
			config.host.should.be.ok
			done()

describe "when lib scaffold is requested", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	config = {}
	before ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--lib", "newlib" ], ( cfg ) -> 
			config = cfg
			done()

	describe "once scaffold is complete", ->
		it "should create source folder", () -> fp.paths["newlib/src"].should.be.ok
		it "should create lib folder", () -> fp.paths["newlib/lib"].should.be.ok
		it "should create ext folder", () -> fp.paths["newlib/ext"].should.be.ok
		it "should create spec folder", () -> fp.paths["newlib/spec"].should.be.ok
		it "should create the standard lib build config", () ->
			# validate that build file is standard site build
			delete config[ "host" ]
			delete config[ "continuous" ]
			_.isEqual( config, defaultLibConfig ).should.be.ok

describe "when site scaffold is requested", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log

	config = {}
	before ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--site", "newSite" ], ( cfg ) -> 
			config = cfg
			done()

	describe "once scaffold is complete", ->
		it "should create source folder", () -> fp.paths["newSite/src"].should.be.ok
		it "should create style folder", () -> fp.paths["newSite/style"].should.be.ok
		it "should create markup folder", () -> fp.paths["newSite/markup"].should.be.ok
		it "should create lib folder", () -> fp.paths["newSite/lib"].should.be.ok
		it "should create css folder", () -> fp.paths["newSite/css"].should.be.ok
		it "should create site/css folder", () -> fp.paths["newSite/site/css"].should.be.ok
		it "should create site/js folder", () -> fp.paths["newSite/site/js"].should.be.ok
		it "should create ext folder", () -> fp.paths["newSite/ext"].should.be.ok
		it "should create spec folder", () -> fp.paths["newSite/spec"].should.be.ok
		it "should create the standard site build config", () ->
			# validate that build file is standard site build
			_.isEqual( config, defaultSiteConfig ).should.be.ok

describe "when requesting new lib build file", ->
	fp = new FP()
	cp = new Configuration fp, scheduler, log
	
	it "should create the default lib configuration", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--libfile", "new" ], ( config ) ->
			fp.read "new.json", ( content ) ->
				obj = JSON.parse content
				delete obj["host"]
				delete obj["continuous"]

				_.isEqual( obj, defaultLibConfig ).should.be.ok
				done()

describe "when requesting new site build file", ->
	fp = new FP()
	process.argv.push "--sitefile"
	process.argv.push "new"
	cp = new Configuration fp, scheduler, log
	
	it "should create the default site configuration", ( done ) ->
		cp.configure [ "coffee", "./bin/anvil", "--sitefile", "new" ], ( config ) ->
			fp.read "new.json", ( content ) ->
				obj = JSON.parse content
				delete obj["host"]
				delete obj["continuous"]
				_.isEqual( obj, defaultSiteConfig ).should.be.ok
				done()

describe "when finalize has string header only", ->
	fp = new FP()

	build = 
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"finalize": 
			"header": "// this is a test header"
			
	expected =
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"finalize": 
			"source": 
				"header": "// this is a test header"
				"footer": ""
		"working": "./tmp"

	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, done

	cp = new Configuration fp, scheduler, log

	it "should use the loaded file", ( complete ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			build.working = "./tmp"
			_.isEqual( config, expected ).should.be.ok
			complete()

describe "when finalize has a file header only", ->
	fp = new FP()

	build = 
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"finalize": 
			"header-file": "test.txt"
			
	expected =
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"finalize": 
			"source": 
				"header": "// this is a test header"
				"footer": ""
		"working": "./tmp"

	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, () ->
			fp.write "test.txt", "// this is a test header", done

	cp = new Configuration fp, scheduler, log

	it "should use the loaded file", ( complete ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			build.working = "./tmp"
			_.isEqual( config, expected ).should.be.ok
			complete()

describe "when wrapping with strings", ->
	fp = new FP()

	build = 
		"source": "thisHereIsMuhSource"
		"output": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"wrap": 
			"prefix": "look at my prefix, ya'll"
			"suffix": "bye, ya'll"
			
	expected =
		"source": "thisHereIsMuhSource"
		"output": 
			"style": "lib"
			"source": "lib"
			"markup": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"wrap": 
			"source":
				"prefix": "look at my prefix, ya'll"
				"suffix": "bye, ya'll"
		"working": "./tmp"

	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, done

	cp = new Configuration fp, scheduler, log

	it "should normalize the wrapper", ( complete ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			build.working = "./tmp"
			_.isEqual( config, expected ).should.be.ok
			complete()

describe "when using a single name customization", ->
	fp = new FP()
	build = 
		"source": "thisHereIsMuhSource"
		"output": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"name": "test/this/is/so/fun/test.js"

	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, done

	cp = new Configuration fp, scheduler, log

	it "should create any path as part of the name", ( complete ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			exists = fp.pathExists "lib/test/this/is/so/fun"
			exists.should.be.ok
			complete()

describe "when using a multiple name customizations", ->
	fp = new FP()
	build = 
		"source": "thisHereIsMuhSource"
		"output": "lib"
		"spec": "spec"
		"ext": "ext"
		"lint": {}
		"uglify": {}
		"gzip": {}
		"hosts":
			"/": "spec"
		"name":
			"one.js": "test/this/is/so/fun/test.js"
			"two.js": "this/is/also/pretty/great/test.js",
			"three.js": "notspecial.js"

	before ( done ) ->
		json = JSON.stringify build
		fp.write "./build.json", json, done

	cp = new Configuration fp, scheduler, log

	it "should create all paths as part of the name", ( complete ) ->
		cp.configure [ "coffee", "./bin/anvil" ], ( config ) ->
			fp.pathExists( "lib/test/this/is/so/fun" ).should.be.ok
			fp.pathExists( "lib/this/is/also/pretty/great" ).should.be.ok
			complete()