fs = require "fs"
path = require "path"
_ = require "underscore"

# ## FSCrawler ##
# Wrote a custom 'dive' replacement after
# the API changed significantly. The needs of Anvil are
# pretty unique - always crawl the whole directory structure
# from the start point and don't start work until we know all the files.
# This 'crawls' a directory and returns all the files in the
# structure recursive.
class FSCrawler

	constructor: ( @scheduler ) ->
		_.bindAll( this )

	# ## crawl ##
	# Crawls the whole directory structure starting with _directory_
	# and returns the full file listing.
	# * _directory {String/Array}_: a string or path spec for the directory to start crawling at
	# * _onComplete {Function}_: the function to call with a complete list of all the files
	crawl: ( directory, onComplete ) ->
		self = this
		fileList = []
		forAll = @scheduler.parallel
		if directory and directory != ""
			# get the fully qualified path
			directory = path.resolve directory
			# read directory contents
			fs.readdir directory, ( err, contents ) ->
				# if we didn't get an error and we have contents
				if not err and contents.length > 0
					qualified = []
					# resolve and push qualified paths into the array
					for item in contents
						qualified.push path.resolve directory, item
					
					# find out if we have a directory or a file handle for
					# all the results from fs.readdir
					self.classifyHandles qualified, ( files, directories ) ->
						fileList = fileList.concat files
						# if we found any directories, continue crawling those
						if directories.length > 0
							forAll directories, self.crawl, ( files ) ->
								fileList = fileList.concat _.flatten files
								onComplete fileList
						# no more directories at this level, return the file list
						else
							onComplete fileList
				# there was a problem or no files, return the list, we're done here
				else
					onComplete fileList
		# no more to do, return the list
		else
			onComplete fileList

	# ## classifyHandles ##
	# Provides a fork/join wrapper around getting the fs stat objects for the list
	# of paths.
	# * _list {Array}_: the list of paths to check
	# * _onComplete {Function}_: the function to call with the lists of files and directories
	classifyHandles: ( list, onComplete ) ->
		if list and list.length > 0
			@scheduler.parallel list, @classifyHandle, ( classified ) ->
				files = []
				directories = []
				for item in classified
					if item.isDirectory 
						directories.push item.file 
					else if not item.error
						files.push item.file
				onComplete files, directories
		else
			onComplete [], []

	# ## classifyHandle ##
	# Get the fs stat and determine if the path is to a file or a directory
	# * _file {String}_: the path to check
	# * _onComplete {Function}_: the function to call with the result of the check
	classifyHandle: ( file, onComplete ) ->	
		fs.stat file, ( err, stat ) ->
			if err
				onComplete { file: file, err: err }
			else
				onComplete { file: file, isDirectory: stat.isDirectory() }
		

exports.crawler = FSCrawler