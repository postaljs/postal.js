# ## Anvil ##
# This provides the primary logic and flow control for build activities
class Anvil

	constructor: ( @fp, @compiler, @combiner, @documenter, @scheduler, @postProcessor, @log, @callback ) ->
		@buildNumber = 0
		@inProcess = false
		
	extensions: [ ".js", ".coffee", ".html", ".haml", ".markdown", ".md", ".css", ".styl", ".less", ".css" ]

	# ## build ##
	# Kicks off the build for the currently configured Anvil instance
	build: ( config ) ->
		if not @inProcess
			@initialize( config )
			@log.onStep "Build #{ @buildNumber } initiated"
			@inProcess = true
			@buildSource()
			@buildStyle()

	# ## buildMarkup ##
	# Builds all markup sources and provides the regex patterns used to
	# identify dependencies using regular expressions.
	buildMarkup: () ->
		findPatterns = [ ///[\<][!][-]{2}.?import[(]?.?['\"].*['\"].?[)]?.?[-]{2}[\>]///g ]
		replacePatterns = [ ///([ \t]*)[\<][!][-]{2}.?import[(]?.?['\"]replace['\"].?[)]?.?[-]{2}[\>]///g ]
		@processType( "markup", findPatterns, replacePatterns )

	# ## buildSource ##
	# Builds all JS and Coffee sources and provides the regex patterns used to
	# identify dependencies using regular expressions.
	buildSource: () ->
		findPatterns = [ ///([/]{2}|[\#]{3}).?import.?[(]?.?[\"'].*[\"'].?[)]?[;]?.?([\#]{0,3})///g ]
		replacePatterns = [ ///([ \t]*)([/]{2}|[\#]{3}).?import.?[(]?.?[\"']replace[\"'].?[)]?[;]?.?[\#]{0,3}///g ]
		@processType( "source", findPatterns, replacePatterns )

	# ## buildSource ##
	# Builds all CSS, LESS and Stylus sources and provides the regex patterns used to
	# identify dependencies using regular expressions.
	buildStyle: () ->
		findPatterns = [ ///([/]{2}|[/][*]).?import[(]?.?[\"'].*[\"'].?[)]?([*][/])?///g ]
		replacePatterns = [ ///([ \t]*)([/]{2}|[/][*]).?import[(]?.?[\"']replace[\"'].?[)]?([*][/])?///g ]
		@processType( "style", findPatterns, replacePatterns )

	# ## initialize
	# Initializes state for the build
	initialize: ( config ) ->
		@config = config
		@filesBuilt = {}
		# mini FSM - basically we don't want to start building markup until
		# everything else is done since markup can import other built resources
		@steps = 
			source: false
			style: false
			markup: false
			hasSource: config.source
			hasStyle: config.style
			hasMarkup: config.markup
			markupReady: () -> ( this.source or not this.hasSource ) and ( this.style or not this.hasStyle )
			allDone: () -> 
				status = ( this.source or not this.hasSource ) and ( this.style or not this.hasStyle ) and ( this.markup or not this.hasMarkup )
				status

	# ## processType ##
	# The steps that get followed for each resource type are the same.
	# This function provides the core behavior of identifying, combining,
	# compiling and post-processing for all the types.
	# * _type {String}_: ('source', 'style', 'markup') the type of resources to process
	# * _findPatterns {Regex}_: the list of regular expressions used to identify imports in this resource type
	# * _replacePatterns {Regex}_: the list of replacement regular expressions used to replace imports with file contents
	processType: ( type, findPatterns, replacePatterns ) ->
		self = this
		forAll = @scheduler.parallel
		compiler = @compiler
		combiner = new @combiner( @fp, @scheduler, findPatterns, replacePatterns )
		postProcessor = @postProcessor

		@log.onStep "Starting #{ type } pipe-line"
		self.prepFiles type, ( list ) ->
			if list and list.length > 0

				self.copyFiles list, () ->
					# combines imported files
					self.log.onStep "Combining #{ type } files"
					combiner.combineList list, () ->
						# filter out all files that were combined into another file
						final = _.filter( list, ( x ) -> x.dependents == 0 )
						# if documentation should be generated, do that now
						if self.config.docs
							self.documenter.generate final
						# compiles the combined results
						self.log.onStep "Compiling #{ type } files"
						forAll final, compiler.compile, ( compiled ) ->
							# kick off post processors for compiled files
							self.log.onStep "Post-process #{ type } files"
							postProcessor[ type ].process compiled, ( list ) ->
								# copy complete files to the destination folders
								self.log.onStep "Moving #{ type } files to destinations"
								self.finalOutput list, () ->
									self.stepComplete type
			else
				self.stepComplete type

	# ## finalOutput ##
	# Copies the final list of files to their output folders
	# * _files {Array}_: the list of files to copy
	# * _onComplete {Function}_: the function to call once all files have been copied
	finalOutput: ( files, onComplete ) ->
		fp = @fp
		names = @config.name
		forAll = @scheduler.parallel
		copy = ( file, done ) ->
			forAll( file.outputPaths, ( destination, moved ) ->
				outputName = file.name
				if names
					if _.isString names 
						outputName = names
					else 
						custom = names[ file.name ]
						outputName = custom or= outputName
				fp.copy [ file.workingPath, file.name ], [ destination, outputName ], moved
			, done )
		forAll files, copy, onComplete

	# ## copyFiles ##
	# Copies the source files to the working path before beginning any processing
	# * _files {Array}_: the list of files to copy
	# * _onComplete {Function}_: the function to call once all files have been copied
	copyFiles: ( files, onComplete ) ->
		fp = @fp
		copy = ( file, done ) -> 
			fp.ensurePath file.workingPath, () -> 
				fp.copy file.fullPath, [ file.workingPath, file.name ], done
		@scheduler.parallel files, copy, onComplete


	# ## cleanWorking ##
	# Clears all files from the working directory
	# * _onComplete {Function}_: the function to call after directory is cleaned
	cleanWorking: ( onComplete ) ->
		fp = @fp
		forAll = @scheduler.parallel
		fp.getFiles @config.working, ( files ) ->
			forAll files, fp.delete, () ->
				onComplete()


	# ## prepFiles ##
	# Determine the list of files that belong to this particular resource type
	# and create metadata objects that describe the file and provide necessary
	# metadata to the rest of the processes.
	# * _type {String}_: ('source', 'style', 'markup') 
	# * _onComplete {Function}_: the function to invoke with a completed list of file metadata
	prepFiles: ( type, onComplete ) ->
		self = this
		workingBase = @config.working
		typePath = @config[ type ]
		output = @config.output[ type ]
		output = if _.isArray( output ) then output else [ output ]
		log = @log
		@fp.getFiles typePath, ( files ) ->
			log.onEvent "Found #{ files.length } #{ type } files ..."
			list = for file in files
						name = path.basename file
						relative = path.dirname( file.replace( typePath, "") )
						working = self.fp.buildPath( workingBase, relative )
						{
							dependents: 0
							ext: () -> path.extname this.name
							fullPath: file
							imports: []
							name: name
							originalName: name
							outputPaths: output
							relativePath: relative
							workingPath: working
						}
			filtered = _.filter list, ( x ) -> _.any self.extensions, ( y ) -> y == x.ext()
			onComplete filtered

	# ## stepComplete ##
	# Called at the end of each type's pipe-line in order to control
	# when markup gets built. Markup must get built last since it can include
	# built targets from both style and source in it's files.
	# * _step {String}_: ('source','style','markup')
	stepComplete: ( step ) ->
		@steps[ step ] = true
		if step != "markup" and @steps.markupReady()
			@buildMarkup()
		if step == "markup" and @steps.allDone()
			@inProcess = false
			@cleanWorking @callback
				
