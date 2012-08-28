colors = require "colors"

class LogMock

	messages: []

	# ## onEvent ##
	# Logs events in default console color
	# ### Args:
	# * _x {String}_: message to log
	onEvent: (x) ->
	    unless @quiet
	        @messages.push "   #{x}"
	        #console.log "   #{x}"


	# ## onStep ##
	# Logs steps in blue
	# ### Args:
	# * _x {String}_: message to log
	onStep: (x) ->
	    unless @quiet
	        @messages.push "#{x}".blue
	        #console.log "#{x}".blue


	# ## onComplete ##
	# Logs successful process completions in green
	# ### Args:
	# * _x {String}_: message to log
	onComplete: (x) ->
	    @messages.push "#{x}".green
	    #console.log "#{x}".green


	# ## onError ##
	# Logs errors in red
	# ### Args:
	# * _x {String}_: message to log
	onError: (x) ->
	    @messages.push "!!! #{x} !!!".red
	    #console.log "!!! #{x} !!!".red

log = new LogMock()

exports.log = log