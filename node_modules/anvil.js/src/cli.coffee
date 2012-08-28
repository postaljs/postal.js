# # Cli
# Provides the command line interface for interacting with Anvil and related modules
class Cli

	constructor: () ->
		@anvil = {}
		
		@ci = undefined
		@documenter = undefined
		@mochaRunner = undefined
		@socketServer = {}
		@postProcessor = {}
		@log = log
		@scheduler = new Scheduler()
		@crawler = new FSCrawler @scheduler
		@fp = new FSProvider @crawler, @log
		@configuration = new Configuration @fp, @scheduler, @log
		@compiler = new Compiler @fp, @log

		_.bindAll this

	initCI: ( config ) ->
		@ci = new Continuous @fp, config, @onFileChange

	initHost: ( config ) ->
		@server = new Host @fp, @scheduler, @compiler, config
		@socketServer = new SocketServer @server.app
		@log.onStep "Static HTTP server listening on port #{ config.port }"

	initMocha: ( config ) ->
		@mochaRunner = new MochaRunner @fp, @scheduler, config, @onTestsComplete

	notifyHttpClients: () ->
		if @socketServer.refreshClients
			@log.onStep "Notifying clients of build completion"
			@socketServer.refreshClients()

	onBuildComplete: () ->
		self = this
		@log.onComplete "Build #{ @anvil.buildNumber++ } completed"
		if self.mochaRunner
			# wrap the mocha runner invocation in a timeout call
			# to prevent odd timing issues.
			self.log.onStep "Running specifications with Mocha"
			self.mochaRunner.run()
		else 
			self.startCI()
			self.notifyHttpClients()

	onConfig: ( config, stop ) ->
		@config = config
		# if stop comes back, then this is not a build and we're done
		if stop then process.exit 0
		
		# if the user wants CI, setup the continuous module
		if config.continuous then @initCI config
			
		# if the user wants mocha to run after the build, setup the mocha runner
		if config.mocha then @initMocha config

		# if the user wants hosting then, spin up the Static HTTP host and socket server
		if config.host then @initHost config

		# create the post processor instance
		@postProcessor = new PostProcessor config, @fp, @scheduler, @log
		@documenter = new Documenter config, @fp, @scheduler, @log
		@anvil = new Anvil @fp, @compiler, Combiner, @documenter, @scheduler, @postProcessor, @log, @onBuildComplete

		@anvil.build( config )
		# if we're using CI, kick it off the first time
		@startCI()

	onFileChange: () ->
		@log.onEvent "File change detected, starting build"
		@fileChange = ->
		@anvil.build( @config )

	onTestsComplete: () ->
		@log.onComplete "Tests completed"
		@startCI()
		@notifyHttpClients()
	
	run: () ->
		@configuration.configure process.argv, @onConfig

	startCI: () ->
		if @ci
			@log.onStep "Starting file watchers"
			@ci.setup()
			

exports.run = ->
	cli = new Cli()
	cli.run()
