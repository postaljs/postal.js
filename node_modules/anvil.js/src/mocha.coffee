Mocha = require "mocha"
_ = require "underscore"
reporters = Mocha.reporters
interfaces = Mocha.interfaces
Context = Mocha.Context
Runner = Mocha.Runner
Suite = Mocha.Suite
path = require "path"

###
	This class is an adaptation of the code found in _mocha
	from TJ Holowaychuk's Mocha repository:
	https://github.com/visionmedia/mocha/blob/master/bin/_mocha
###
class MochaRunner

	constructor: ( @fp, @scheduler, @config, @onComplete ) ->
		_.bindAll( this )
		
	run: () ->
		self = this
		if @config.spec
			forAll = @scheduler.parallel

			opts = @config.mocha or=
				growl: true
				ignoreLeaks: true
				reporter: "spec"
				ui: "bdd"
				colors: true

			reporterName = opts.reporter.toLowerCase().replace( ///([a-z])///, ( x ) -> x.toUpperCase() )
			uiName = opts.ui.toLowerCase()
			mocha = new Mocha( {
				ui: uiName
				ignoreLeaks: true
				colors: opts.colors
				growl: opts.growl
				slow: opts.slow
				timeout: opts.timeout	
			} )
			mocha.reporter(reporterName)

			specs = if _.isString @config.spec then [ @config.spec ] else @config.spec

			forAll specs, @fp.getFiles, ( lists ) ->
				files = _.flatten lists
				for file in files
					delete require.cache[ file ]
					mocha.addFile file

				mocha.run () ->
					self.onComplete()
