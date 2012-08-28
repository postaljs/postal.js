# Unfancy JavaScript -- 
# See http://coffeescript.org/ for more info
coffeeScript = require "coffee-script"

# LESS Compiler --
# See http://lesscss.org
less = require( "less" )

# STYLUS Compiler --
# See http://learnboost.github.com/stylus/
stylus = require( "stylus" )

# HAML Compiler --
# See http://haml-lang.com/
haml = require( "haml" )

# Markdown Compiler --
# See http://github.com/chjj/marked
marked = require( "marked" )
marked.setOptions { sanitize: false }

# HAML Compiler --
# See http://haml-lang.com/
coffeeKup = require( "coffeekup" )

# underscore --
# The most essential JS lib that ever was
# See http://underscorejs.org/
_ = require "underscore"

# ## Compiler ##
# 'Compiles' files based on the extension to produce
# browser friendly resources: JS, CSS, HTML
class Compiler

	constructor: (@fp, @log) ->
		_.bindAll( this )

	# ## compile ##
	# Compiles a file with the correct compiler
	# ### Args:
	# * _file {Object}_: file metadata for the file to compile
	# * _onComplete {Function}_: function to invoke when done
	compile: ( file, onComplete ) ->
		self = this
		ext = file.ext()
		newExt = @extensionMap[ ext ]
		newFile = file.name.replace ext, newExt
		log = @log
		log.onEvent "Compiling #{ file.name } to #{ newFile }"
		compiler = @compilers[ ext ]
		if compiler
			@fp.transform( 
				[ file.workingPath, file.name ],
				compiler,
				[ file.workingPath, newFile ],
				( err ) ->
					unless err
						file.name = newFile
						onComplete file
					else
						log.onError "Error compiling #{ file.name }: \r\n #{ err }"
						onComplete err
			)
		else
			onComplete file

	# ## extensionMap ##
	# Provides a map of original to resulting extension
	extensionMap:
		".js": ".js"
		".css": ".css"
		".html": ".html"
		".coffee" : ".js"
		".kup": ".html"
		".less": ".css"
		".styl": ".css"
		".sass": ".css"
		".scss": ".css"
		".haml": ".html"
		".md": ".html"
		".markdown": ".html"

	# ## compilers ##
	# A simple hash map of file extension to a function that
	# invokes the corresponding compiler
	compilers:
		".coffee" : ( content, onContent ) ->
			try
				js = coffeeScript.compile content, { bare: true }
				onContent js
			catch error
				onContent "", error
		".less" : ( content, onContent ) ->
			try
				less.render( content, {}, (e, css) -> onContent(css) )
			catch error
				onContent "", error
		".sass" : ( content, onContent ) ->
			try
				onContent content
			catch error
				onContent "", error
		".scss" : ( content, onContent ) ->
			try
				onContent content
			catch error
				onContent "", error
		".styl" : ( content, onContent ) ->
			try
				stylus.render( content, {}, (e, css) -> onContent( css, e ) )
			catch error
				onContent "", error
		".haml" : ( content, onContent ) ->
			try
				html = haml.render content
				onContent html
			catch error
				onContent "", error
		".md" : ( content, onContent ) ->
			try
				onContent( marked.parse( content ) )
			catch error
				onContent "", error
		".markdown" : ( content, onContent ) ->
			try
				onContent( marked.parse( content ) )
			catch error
				onContent "", error
		".kup" : ( content, onContent ) ->
			try
				html =( coffeeKup.compile content, {} )()
				onContent html
			catch error
				onContent "", error

exports.compiler = Compiler
