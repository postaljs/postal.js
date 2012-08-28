_ = require "underscore"
log = require( "./logMock.coffee" ).log
path = require "path"
Scheduler = require( "../src/scheduler.coffee").scheduler
scheduler = new Scheduler()
Crawler = require( "../src/crawler.coffee").crawler 
crawler = new Crawler scheduler
FSProvider = require( "../src/file").fsProvider
fp = new FSProvider crawler, log
require "should"

describe "when listing files from a directory structure", ->

	it "should get complete file list", ( done ) ->
		fp.getFiles "../ext", ( files ) ->
			files.length.should.equal 5
			done()