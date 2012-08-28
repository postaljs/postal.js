_ = require "underscore"
Scheduler = require( "../src/scheduler.coffee").scheduler
scheduler = new Scheduler()
require "should"

describe "when building an item through a pipeline", ->

	start = ""
	step1 = ( x, done ) -> done( x + "hello" )
	step2 = ( x, done ) -> done( x + " " )
	step3 = ( x, done ) -> done( x + "world" )
	step4 = ( x, done ) -> done( x + "!" )
	expected = "hello world!"

	steps = [ step1, step2, step3, step4 ]

	it "should run pipeline in order", ( done ) ->
		scheduler.pipeline start, steps, ( result ) ->
			result.should.equal expected
			done()

describe "when manipulating a single item through a pipeline", ->

	start = 100
	step1 = ( x, done ) -> done( x / 2 )
	step2 = ( x, done ) -> done( x - 25 )
	step3 = ( x, done ) -> done( x / 5 )
	step4 = ( x, done ) -> done( x + 5 )
	expected = 10

	steps = [ step1, step2, step3, step4 ]

	it "should run pipeline in order", ( done ) ->
		scheduler.pipeline start, steps, ( result ) ->
			result.should.equal expected
			done()

describe "when mutating a single item through a pipeline", ->

	start = "<1> [2] {3}"
	step1 = ( x, done ) -> done( x.replace ///[<]1[>]///, "one" )
	step2 = ( x, done ) -> done( x.replace ///[\[]2[\]]///, "two" )
	step3 = ( x, done ) -> done( x.replace ///[\{]3[\}]///, "three" )
	expected = "one two three"

	steps = [ step1, step2, step3 ]

	it "should run pipeline in order", ( done ) ->
		scheduler.pipeline start, steps, ( result ) ->
			result.should.equal expected
			done()

describe "when running calls in parallel", ->

	start = [ 2, 3, 4 ]
	call = ( x, done ) -> done x * 2
	expected = [ 4, 6, 8 ]

	it "should return collection (in any order)", ( done ) ->
		scheduler.parallel start, call, ( result ) ->
			_.difference( result, expected ).length.should.equal 0
			done()

describe "when aggregating multiple calls", ->

	calls =
		one: ( done ) -> setTimeout () -> 
								done 1
							, 10
		two: ( done ) -> setTimeout () -> 
								done 2
							, 5
		three: ( done ) -> setTimeout () -> 
								done 3
							, 1

	it "should complete with correctly constructed object", ( done ) ->
		scheduler.aggregate calls, ( result ) ->
			result.one.should.equal 1
			result.two.should.equal 2
			result.three.should.equal 3
			done()