_ = require "underscore"
# ## Scheduler ##
# Provides flow control abstractions
# aggregate and parallel are essentially fork/join variations and
# pipeline is an asynchronous way to pass an input through a series
# of transforms.
class Scheduler

	constructor: () ->

	# ## parallel ##
	# This takes a list of items and a single asynchronous
	# function with the signature ( item, done ) and
	# calls the worker for each item only invoking onComplete
	# once all calls have completed.
	# * _items {Array}_: a list of items to process
	# * _worker {Function}_: the worker that processes all the items
	# * _onComplete {Function}_: the function to call once all workers have completed
	parallel: ( items, worker, onComplete ) ->
		# Fail fast if list is empty
		if not items or items.length == 0
			onComplete []
		count = items.length
		results = []
		# Pushes _result_ (if truthy) onto the _results_ list and, if there are no more
		# items, calls _onComplete_ with _results_
		done = ( result ) ->
			count = count - 1
			# Is _result_ truthy?
			if result
				# Append to _results_!
				results.push result
			# Is iteration complete?
			if count == 0
				# Call _onComplete_!
				onComplete( results )
		# Iteration occurs here
		worker( item, done ) for item in items

	# ## pipeline ##
	# This takes an item and mutates it by calling a series
	# of asynchronous workers with the signature ( item, done ) and
	# only invokes onComplete after the last function in the pipeline completes.
	# * _item {Object}_: the initial item to pass to the first call
	# * _workers {Array}_: the ordered list of functions that compose the pipeline
	# * _onComplete {Function}_: the function to call once the last function has completed
	pipeline: ( item, workers, onComplete ) ->
		# Fail fast if list is empty
		if item == undefined or not workers or workers.length == 0
			onComplete item || {}

		# take the next worker in the list
		# and pass item (in its current state) to it
		iterate = ( done ) ->
			worker = workers.shift()
			worker item, done
		done = ->
		done = ( product ) ->
			# store the mutated product of the worker
			item = product
			# Any workers remaining?
			if workers.length == 0
				# Call _onComplete_!
				onComplete( product )
			else
				iterate done

		# kick off the pipeline
		iterate done

	# ## aggregate ##
	# Takes a hash map of calls and returns a corresponding hash map of
	# the results once all calls have completed. It's a weird fork/join
	# with named results vs. a randomly ordered list of results
	# * _calls {Object}_: the hash map of named asynchronous functions to call
	# * _onComplete {Function}_: the resulting hash map of corresponding values
	aggregate: ( calls, onComplete ) ->
		results = {}
		# checks to see if all results have been collected
		isDone = () -> 
			_.chain( calls ).keys().all( ( x ) -> results[ x ] != undefined ).value()
		
		# build a callback for the specific named function
		getCallback = ( name ) ->
			( result ) ->
				results[ name ] = result
				# have all the other calls completed?
				if isDone()
					onComplete results

		# iterate through the call list and invoke each one
		_.each( calls, ( call, name ) ->
			callback = getCallback name
			call callback
		)

exports.scheduler = Scheduler
