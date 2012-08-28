class Log

	# ## onEvent ##
	# Logs events in default console color
	# ### Args:
	# * _x {String}_: message to log
	onEvent: (x) ->
		unless quiet
			console.log "   #{x}"


	# ## onStep ##
	# Logs steps in blue
	# ### Args:
	# * _x {String}_: message to log
	onStep: (x) ->
		unless quiet
			console.log "#{x}".blue


	# ## onComplete ##
	# Logs successful process completions in green
	# ### Args:
	# * _x {String}_: message to log
	onComplete: (x) ->
		console.log "#{x}".green


	# ## onError ##
	# Logs errors in red
	# ### Args:
	# * _x {String}_: message to log
	onError: (x) ->
		console.log "!!! #{x} !!!".red

log = new Log()

exports.log = log