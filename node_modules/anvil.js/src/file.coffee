fs = require "fs"
_ = require "underscore"

# ## FSProvider ##
# An abstraction around file interaction.
# This is necessary to test any of Anvil's file level
# interactions.
class FSProvider
	
	constructor: ( @crawler, @log ) ->
		_.bindAll this

	# ## buildPath ##
	# Given an array or string pathspec, return a string pathspec
	# ### Args:
	# * _pathSpec {Array, String}_: pathspec of either an array of strings or a single string
	buildPath: ( pathSpec ) ->
		if not pathSpec 
			""
		else
			fullPath = pathSpec
			if _.isArray( pathSpec )
				fullPath = path.join.apply {}, pathSpec
			fullPath

	# ## delete ##
	# Deletes a file, given the file name (_file_) and its parent (_dir_)
	# ### Args:
	# * _dir {String}_: pathspec of parent dir
	# * _filePath {String}_: file name or path spec array
	# * _onDeleted {Function}_: callback called if the file delete is successful
	delete: ( filePath, onDeleted ) ->
		filePath = @buildPath filePath
		if @pathExists filePath
			fs.unlink filePath, ( err ) ->
				onDeleted()
			

	# ## ensurePath ##
	# Makes sure _pathSpec_ path exists before calling _onComplete_ by
	# calling _mkdir pathSpec..._ if _pathSpec_ does not initially exist
	# ### Args:
	# * _pathSpec {String}_: path string or array
	# * _onComplete {Function}_: called if path exists or is successfully created
	ensurePath: ( pathSpec, onComplete ) ->
		pathSpec = @buildPath pathSpec
		path.exists pathSpec, ( exists ) ->
			unless exists
				# No _target_ yet. Let's make it!
				mkdir pathSpec, "0755", ( err ) ->
					# Couldn't make the path. Report and abort!
					if err
						log.onError "Could not create #{pathSpec}. #{err}"
					else
						onComplete()
			else
				onComplete()

	# ## getFiles ##
	# Get all files in a specific path specification
	# * _filePath {String/Array}_: a string or array specifying the path to get files for
	# * _onFiles {Function}_: the function to call with the list of full file paths
	getFiles: ( filePath, onFiles ) ->
		if not filePath 
			onFiles []
		else
			filePath = @buildPath filePath
			files = []
			@crawler.crawl filePath, onFiles

	# ## copy ## 
	# Copy a file
	# * _from {String/Array}_: the path spec for the file to copy
	# * _to {String/Array}_: the path spec for the destination
	# * _onComplete {Function}_: the function to call when the copy has completed
	copy: ( from, to, onComplete ) ->
		from = this.buildPath from
		to = this.buildPath to
		readStream = undefined
		writeStream = fs.createWriteStream( to )
		( readStream = fs.createReadStream( from ) ).pipe( writeStream )
		readStream.on 'end', () ->
			if writeStream
				writeStream.destroySoon()
			onComplete()

	# ## pathExists ##
	# Sychronously (GASP) check for the existence of a file or directory
	# * _pathSpec {String/Array}_: the string or path spec of the file or directory to check for
	pathExists: ( pathSpec ) ->
		pathSpec = this.buildPath pathSpec
		path.existsSync pathSpec

	# ## read ##
	# Reads a file from _filePath_ and calls _onFile_ callback with contents (Asynchronously)
	# ### Args:
	# * _filePath {String}_: pathspec of file to read and pass contents from
	# * _onContent {Function}_: callback to pass file's contents to
	read: ( filePath, onContent ) ->
		filePath = @buildPath filePath
		fs.readFile filePath, "utf8", ( err, content ) ->
			if err
				log.onError "Could not read #{ filePath } : #{ err }"
				onContent "", err
			else
				onContent content

	# ## readSync ##
	# Reads a file from _filePath_ ... synchronously ... SHAME! SHAAAAAAME! (ok, not really)
	# This function only exists for a specific use case in config, where there's literally
	# no advantage to reading files asynchronously but writing the code that way would
	# be a huge pain. Rationalization FTW
	# ### Args:
	# * _filePath {String}_: pathspec of file to read and pass contents from
	readSync: ( filePath ) ->
		filePath = @buildPath filePath
		try
			fs.readFileSync filePath, "utf8"
		catch err
			log.onError "Could not read #{ filePath } : #{ err }"
			err

	# ## transformFile ##
	# Given input file _filePath_, perform _transform_ upon it then write the transformed content
	# to _outputPath_ and call _onComplete_. (All operations performed asynchronously.)
	# ### Args:
	# * _filePath {String}_: pathspec of file to transform
	# * _transform {Function}_: transform to perform on the file
	# * _outputPath {String}_: pathspec of output file
	# * _onComplete {Function}_: called when all operations are complete
	transform: ( filePath, transform, outputPath, onComplete ) ->
		self = this
		filePath = @buildPath filePath
		outputPath = @buildPath outputPath
		this.read(
			filePath,
			( content ) ->
				transform content, ( newContent, error ) ->
					if not error
						self.write outputPath, newContent, onComplete
					else
						onComplete error
		)

	# ## write ##
	# Writes _content_ to file at _filePath_ calling _done_ after writing is complete (Asynchronously)
	# ### Args:
	# * _filePath {String}_: pathspec of file to write
	# * _content {String}_: content to write to the file
	# * _onComplete {Function}_: called when all operations are complete
	write: ( filePath, content, onComplete ) ->
		filePath = @buildPath filePath
		fs.writeFile filePath, content, "utf8", ( err ) ->
			if err
				log.onError "Could not write #{ filePath } : #{ err }"
				onComplete err
			else
				onComplete()

exports.fsProvider = FSProvider

