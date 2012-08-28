express = require 'express'

# ## Host ##
# This class provides a simple static HTTP server
# that can support all supported files types for Anvil
# builds
class Host

	constructor: ( @fp, @scheduler, @compiler, @config ) ->
		self = this
		_.bindAll( this )

		@app = express.createServer()
		app = @app
		app.use express.bodyParser()
		app.use app.router

		hosts = @config.hosts
		# if the user told us what to do, make no assumptions
		# only host exactly what they specify
		if hosts
			_.each( hosts, ( value, key ) ->
				app.use key, express.static( path.resolve value )
			)
		# otherwise, let's have some fun...
		else 
			output = @config.output
			target = ""
			if @config.markup # this is a site
				if _.isString output 
					target = output
				else if _.isArray output
					target = output[ 0 ]
				else
					target = output.markup
			else # this is a lib
				if _.isString output 
					target = output
				else if _.isArray output
					target = output[ 0 ]
				else
					target = output.source
			app.use "/", express.static( path.resolve target )

		if @config.ext
			app.use "/ext", express.static( path.resolve @config.ext )
		if @config.spec
			app.use "/spec", express.static( path.resolve @config.spec )

		# host anvil prerequisites for supporting certain browser features out of
		# the box
		anvilPath = path.resolve( path.dirname( fs.realpathSync( __filename ) ), "../ext" )
		console.log "Hosting anvil prerequisites from #{ anvilPath }"
		app.use "/anvil", express.static( anvilPath )

		# if a static file type is requested that fits an extension we know how to
		# compile, use the compiler to translate it on-the-fly
		app.get ///.*[.](coffee|kup|less|styl|md|markdown|haml)///, ( req, res ) ->
			fileName = ".#{ req.url }"

			ext = path.extname fileName
			mimeType = self.contentTypes[ ext ]
			res.header 'Content-Type', mimeType
			self.fp.read fileName, ( content ) ->
				self.compiler.compilers[ ext ] content, ( compiled ) ->
					res.send compiled

		port = if @config.port then @config.port else 3080
		app.listen port

	contentTypes:
		".coffee": "application/javascript"
		".less": "text/css"
		".styl": "text/css"
		".md": "text/html"
		".markdown": "text/html"
		".haml": "text/html"
		".kup": "text/html"