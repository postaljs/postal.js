_ = require "underscore"
path = require "path"
Commander = require( "commander" ).Command


# Configuration container
config = { }

# Configuration defaults
siteConfig =
	"source": "src"
	"style": "style"
	"markup": "markup"
	"output": 
		{
			"source": [ "lib", "site/js" ],
			"style": [ "css", "site/css" ],
			"markup": "site/"
		}
	"spec": "spec"
	"ext": "ext"
	"lint": {}
	"uglify": {}
	"cssmin": {}
	"hosts": {
	  "/": "site"
	}

libConfig = 
	"source": "src"
	"output": "lib"
	"spec": "spec"
	"ext": "ext"
	"lint": {}
	"uglify": {}
	"hosts": {
	  "/": "spec"
	}

defaultMocha =
	growl: true
	ignoreLeaks: true
	reporter: "spec"
	ui: "bdd"
	colors: true

defaultDoc =
	generator: "docco"
	output: "docs"

continuous = test = inProcess = quiet = debug = false

ext =
	gzip: "gz"
	uglify: "min"
	cssmin: "min"

extensionLookup = 
	".css": "style"
	".scss": "style"
	".sass": "style"
	".less": "style"
	".stylus": "style"
	".js": "source"
	".coffee": "source"
	".markdown": "markup"
	".md": "markup"
	".html": "markup"

# ## Configuration ##
# Do all the things!
# Calling anvil from the command line runs this.
class Configuration 

	constructor: ( @fp, @scheduler, @log ) ->

	# ## configure ##
	# this call will return a configuration object that will
	# inform the rest of the process
	# * _onConfig {Function}_: the callback to invoke with a configuration object
	configure: ( argList, onConfig ) ->
		self = this
		command = new Commander()
		command
			.version("0.7.9")
			.option( "-b, --build [build file]", "Use a custom build file", "./build.json" )
			.option( "--ci", "Run a continuous integration build" )
			.option( "--host", "Setup a static HTTP host" )
			.option( "--lib [project]", "Create a lib project at the folder [project]" )
			.option( "--libfile [file name]", "Create a new lib build file named [file name]" )
			.option( "--site [project]", "Create a site project at the folder [project]" )
			.option( "--sitefile [file name]", "Create a new site build file named [file name]" )
			.option( "--mocha", "Run specifications using Mocha" )
			#.option( "--docco", "Create annotated source using docco" )
			.option( "--ape", "Create annotated source using ape" )
			.option( "-q, --quiet", "Only print completion and error messages" )

		command.parse( argList );

		if command.libfile or command.sitefile
			# Generate all the directories and the config file
			name = command.libfile or= command.sitefile
			type = if command.sitefile then 'site' else 'lib'
			@writeConfig type, "#{name}.json", () ->
				self.log.onComplete "Created #{ type } build file - #{ name }"
				onConfig config, true
		else if command.site or command.lib
			# Generate all the directories and the config file
			type = if command.site then 'site' else 'lib'
			scaffold = command.site or= command.lib
			config = if type == 'site' then siteConfig else libConfig
			@log.onStep "Creating scaffolding for new #{ type } project"
			# Create all the directories
			self.ensurePaths( () ->
				self.writeConfig( type, scaffold + "/build.json", () ->
					self.log.onComplete "Scaffold ( #{ scaffold } ) created."
					onConfig config, true
				)
			, scaffold )
		else
			buildFile = command.build
			@log.onStep "Checking for #{ buildFile }"
			exists = @fp.pathExists buildFile
			@prepConfig exists, buildFile, () ->
				if command.host
					config.host = true

				if command.ci
					config.continuous = true

				if command.mocha
					config.mocha = defaultMocha

				if command.ape
					config.docs = defaultDoc
					config.docs.generator = "ape"

				if command.docco
					config.docs = defaultDoc

				# Run transforms and generate output
				self.ensurePaths () ->
					onConfig config		

	# ## createLibBuild ##
	# This creates a file containing the default lib build convention
	createLibBuild: () ->
		# build lib template?
		if buildLibTemplate
			output = if buildLibTemplate == true then "build.json" else buildLibTemplate
			writeConfig "lib", output
			global.process.exit(0)
			config

	# ## createSiteBuild ##
	# This creates a file containing the default site build convention
	createSiteBuild: () ->
		# build site template?
		if buildSiteTemplate
			output = if buildSiteTemplate == true then "build.json" else buildSiteTemplate
			writeConfig "site", output
			global.process.exit(0)
			config

	# ## ensurePaths ##
	# Make sure that all expected paths exist
	# ### Args:
	# * _onComplete {Function}_: what to call when work is complete
	# * _prefix {String}_: the prefix to prepend to all paths
	ensurePaths: ( onComplete, prefix ) ->
		self = this
		prefix = prefix or= ""
		config.working = config.working || "./tmp"
		fp = @fp
		paths = [
			config[ "source" ]
			config[ "style" ]
			config[ "markup" ]
			config[ "spec" ]
			config[ "ext" ]
			config[ "working" ]
		]

		# if documenting
		if config.docs
			paths.push config.docs.output
		
		outputList = []
		# if the output is an object
		if _.isObject config.output
			outputList = _.flatten config.output
		else
			# if output is a single path
			outputList = [ config.output ]
		paths = paths.concat outputList

		# if names
		name = config.name
		if name
			for output in outputList
				if _.isString name
					nestedPath = path.dirname name
					if nestedPath 
						paths.push path.join output, nestedPath
				else
					nestedPaths = _.map _.flatten( name ), ( x ) -> path.join output, path.dirname( x )
					paths = paths.concat nestedPaths

		worker = ( p, done ) -> 
			try 
				fp.ensurePath [ prefix, p ], () ->
					done()
			catch err
				done()

		@log.onStep "Ensuring project directory structure"
		@scheduler.parallel paths, worker, onComplete

	# ## prepConfig ##
	# Fallback to default config, if specified config doesn't exist
	# ### Args:
	# * _exists {Boolean}_: does the specified config file exist?
	# * _file {String}_: config file name
	# * _onComplete {Function}_: what to do after config is prepped
	prepConfig: ( exists, file, onComplete ) ->
		self = this
		onDone = () -> self.normalizeConfig onComplete		
		unless exists
			@loadConvention( onDone )
		else
			@loadConfig( file, onDone )

	# ## loadConfig ##
	# Setup full configuration using specified config file 
	# For example, anvil -b custom.json
	# ### Args:
	# * _file {String}_: config file name
	# * _onComplete {Function}_: what to do after config is loaded
	loadConfig: ( file, onComplete ) ->
		@log.onStep "Loading config..."
		fp = @fp
		fp.read file, ( content ) ->
			config = JSON.parse( content )
			if config.extensions
				ext.gzip = config.extensions.gzip || ext.gzip
				ext.uglify = config.extensions.uglify || ext.uglify

			# Carry on!
			onComplete()

	# ## loadConvention ##
	# Sets up default config if no config file is found
	# ### Args:
	# * _onComplete {Function}_: what to do after config is setup
	loadConvention: ( onComplete ) ->
		isSite = @fp.pathExists "./site"
		conventionConfig = if isSite then siteConfig else libConfig
		@log.onStep "No build file found, using #{ if isSite then 'site' else 'lib' } conventions"
		config = conventionConfig
		onComplete()

	# ## normalizeConfig ##
	# Tries to normalize differences in configuration formats
	# between options and site vs. lib configurations
	# #### Args:
	# * _onComplete {Function}_: what to call when work is complete
	normalizeConfig: ( onComplete ) ->
		self = this
		fp = @fp
		config.output = config.output || "lib"
		if _.isString config.output
			outputPath = config.output
			config.output =
				style: outputPath
				source: outputPath
				markup: outputPath

		calls = []

		# finalization?
		finalize = config.finalize
		if finalize 
			calls.push ( done ) -> 
				self.getFinalization finalize, ( result ) -> 
					config.finalize = result
					done()
		# wrapping?
		wrap = config.wrap
		if wrap
			calls.push ( done ) -> 
				self.getWrap wrap, ( result ) -> 
					config.wrap = result
					done()

		if config.mocha
			config.mocha = _.extend defaultMocha, config.mocha

		if config.docs
			config.docs = _.extend defaultDoc, config.docs

		# any calls?
		if calls.length > 0
			@scheduler.parallel calls, 
				( call, done ) -> 
					call( done )
				, () -> onComplete()
		else
			onComplete()


	# ## getFinalization ##
	# Build up a custom state machine to address how
	# finalization should happen for this project
	# ### Args:
	# * _original {Object}_: the existing finalization block
	# * _onComplete {Function}_: what to call when work is complete
	getFinalization: ( original, onComplete ) ->
		self = this
		finalization = {}
		result = {}
		aggregation = {}
		aggregate = @scheduler.aggregate
		
		# if there's no finalization
		if not original or _.isEqual original, {}
			onComplete finalization
		# if there's only one section
		else if original.header or 
				original["header-file"] or 
				original.footer or 
				original["footer-file"]
			# build out aggregation for resolving header and footer
			@getContentBlock original, "header", aggregation
			@getContentBlock original, "footer", aggregation
			# make sure we don't try to aggregate on empty
			if _.isEqual aggregation, {}
				onComplete finalization
			else
				aggregate aggregation, ( constructed ) ->
					finalization.source = constructed
					onComplete finalization
		# there are multiple sections
		else
			sources = {}
			blocks = { 
				"source": original[ "source" ], 
				"style": original[ "style" ], 
				"markup": original[ "markup" ] 
			}
			_.each( blocks, ( block, name ) -> 
				subAggregate = {}
				self.getContentBlock block, "header", subAggregate
				self.getContentBlock block, "footer", subAggregate
				sources[ name ] = ( done ) -> 
					aggregate subAggregate, done
			)
			aggregate sources, onComplete

	# ## getWrap ##
	# Build up a custom state machine to address how
	# wrapping should happen for this project
	# ### Args:
	# * _original {Object}_: the existing wrap block
	# * _onComplete {Function}_: what to call when work is complete
	getWrap: ( original, onComplete ) ->
		self = this
		wrap = {}
		result = {}
		aggregation = {}
		aggregate = @scheduler.aggregate
		# if there's no wrap
		if not original or _.isEqual original, {}
			onComplete wrap
		# if there's only one section
		else if original.prefix or 
				original["prefix-file"] or 
				original.suffix or 
				original["suffix-file"]
			# build out aggregation for resolving prefix and suffix
			@getContentBlock original, "prefix", aggregation
			@getContentBlock original, "suffix", aggregation
			# make sure we don't try to aggregate on empty
			if _.isEqual aggregation, {}
				onComplete wrap
			else
				aggregate aggregation, ( constructed ) ->
					wrap.source = constructed
					onComplete wrap
		# there are multiple sections
		else
			sources = {}
			blocks = { 
				"source": original[ "source" ], 
				"style": original[ "style" ], 
				"markup": original[ "markup" ] 
			}
			_.each( blocks, ( block, name ) -> 
				subAggregate = {}
				self.getContentBlock block, "prefix", subAggregate
				self.getContentBlock block, "suffix", subAggregate
				sources[ name ] = ( done ) -> aggregate subAggregate, done
			)
			aggregate sources, onComplete

	# ## getContentBlock ##
	# Normalizes a wrapper or finalizer segment
	# ### Args:
	# * _property {string}: the property name to check for
	# * _source {Object}_: the configuration block
	# * _onComplete {Function}_: what to call when work is complete
	getContentBlock: ( source, property, aggregation ) ->
		aggregation[ property ] = ( done ) -> done ""
		fp = @fp
		if source
			propertyPath = source["#{ property }-file"]
			propertyValue = source[ property ]
			if propertyPath and @fp.pathExists propertyPath
				aggregation[ property ] = ( done ) -> 
					fp.read propertyPath, ( content ) ->
						done content
			else if propertyValue
				aggregation[ property ] = ( done ) -> done propertyValue

	# ## writeConfig ##
	# Creates new default config file
	# ### Args:
	# * _name {String}_: the config file name
	# * _onComplete {Function}_: what to call when work is complete
	writeConfig: ( type, name, onComplete ) ->
		config = if type == "lib" then libConfig else siteConfig
		log = @log
		json = JSON.stringify( config, null, "\t" )
		@fp.write name, json, () ->
			log.onComplete "#{name} created successfully!"
			onComplete()

exports.configuration = Configuration
