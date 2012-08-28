# docco --
# See http://jashkenas.github.com/docco/
#docco = require "docco"

# ape --
# See 
ape = require "ape"

# ## Documents ##
# A minor adaptation of @aaronmccall's docco and ape support
# that he contributed to the prior version of Anvil.
class Documenter
	
	constructor: ( @config, @fp, @scheduler, @log ) ->
		self = this
		_.bindAll( this )
		if @config.docs
			#if @config.docs.generator == "docco"
			#	@generator = @runDocco
			#else 
			@generator = @runApe
		else
			@generator = () -> 
				callback = Array.prototype.slice.call arguments, 4
				if callback
					callback()

	# ## generate ##
	# Generate documents for the list of files
	# * _files {Array}_: the array of file objects to create documents for
	generate: ( files ) ->
		self = this
		if files && files.length > 0
			@log.onEvent "Creating annotated source for: #{ _.pluck( files, 'name' ).toString() }"
			@scheduler.parallel files, @document, () ->
				self.log.onComplete "Code annotation completed"

	# ## document ##
	# Generate docco/ape annotated source for the combined file
	# Thanks much to @aaronmccall for contributing this code to Anvil!
	# * _file {String}_: the file object to create the document for
	# * _onComplete {Function}_: the function to call once the documentation is done
	document: ( file, onComplete ) ->
		self = this
		language = ape.get_language file.name
		ext = file.ext()
		newFile = file.name.replace ext, ".html"

		@log.onEvent "Annotation for #{ file.name }"
		@fp.read [ file.workingPath, file.name ], ( content ) ->
			self.generator language, ext, newFile, content, ( doc ) ->
				self.fp.write [ self.config.docs.output, newFile ], doc, onComplete

	# ## runDoco ##
	# Wraps the document generation function in docco to a standard call format
	#runDocco: ( language, extension, newFile, code, onComplete ) ->
	#	docco.generate_doc_from_string newFile, code, extension, ( result ) -> onComplete result

	# ## runApe ##
	# Wraps the document generation function in docco to a standard call format
	runApe: ( language, extension, newFile, code, onComplete ) ->
		ape.generate_doc code, language, 'html', null, ( err, result ) -> onComplete result
		