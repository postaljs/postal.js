# ## Continuous ##
# Provides a way to trigger the build on file change
class Continuous

	constructor: ( @fp, @config, @onChange ) ->
		@style = @normalize @config.style
		@source = @normalize @config.source
		@markup = @normalize @config.markup
		@spec = @normalize @config.spec
		@watchers = []
		@watching = false
		_.bindAll( this )
		this

	# ## normalize ##
	# Takes an input and, if it is an array, returns the plain array
	# if the input is not an array, it turns it into a single element array
	# * _x {Object}_: anything
	normalize: ( x ) -> if _.isArray x then x else [ x ]

	# ## setup ##
	# Determines which directories should cause a build to trigger
	# if any contents change
	setup: () ->
		if not @watching
			@watching = true
			if @style then @watchPath p for p in @style
			if @source then @watchPath p for p in @source
			if @markup then @watchPath p for p in @markup
			if @spec then @watchPath p for p in @spec

	# ## watchpath ##
	# Calls watchFiles for all files in the path
	# * _path {String/Array}_: the path specification to watch for changes in
	watchPath: ( path ) ->
		@fp.getFiles path, @watchFiles

	# ## watchFiles ##
	# Creates a file watcher instance for all files in the list
	# * _files {Array}_: the list of files to watch for changes in
	watchFiles: ( files ) ->
		for file in files
			@watchers.push fs.watch file, @onEvent

	# ## onEvent ##
	# This handler triggers the build and closes all watchers in the event 
	# of a change. This is necessary to prevent event storms that can trigger 
	# during the build process.
	# * _event {Object}_: the event that fired on the file system
	# * _file {String}_: the file that triggered the change
	onEvent: ( event, file ) ->
		if @watching
			@watching = false
			while @watchers.length > 0
				@watchers.pop().close()
			@onChange()
