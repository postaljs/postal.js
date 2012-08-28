_ = require "underscore"
log = require( "./logMock.coffee" ).log
FP = require( "./fsMock.coffee" ).fsProvider
Anvil = require( "../src/anvil")
Scheduler = require( "../src/scheduler.coffee").scheduler
scheduler = new Scheduler()
require "should"