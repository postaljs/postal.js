_ = require "underscore"
postal = require "postal"
machina = require "machina"
path = require "path"

log = require( "./logMock.coffee" ).log
FP = require( "./fsMock.coffee" ).fsProvider
Scheduler = require( "../src/scheduler.js" )( _ )
fp = new FP()
scheduler = new Scheduler()
Combiner = require( "../src/combiner.js" )( _, fp, scheduler )
FM = require( "../src/fileMachine.js" )( _, fp, scheduler, postal, machina )

require "should"


coffeeOne = """
class Test
	method: () ->
		console.log "I'm a coffee file, yo!"
"""


describe "creating files for tests", () ->

	before ( done ) ->
		scheduler.

describe "when creating a new file state machine", () ->



	before ( done ) ->
