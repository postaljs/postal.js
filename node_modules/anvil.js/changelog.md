# Anvil.js Change Log

## 0.7.9

* #38 - Improved support for Mocha and fixed a continuous integration related bug by using its new JS API and simplifying the clean up approach used between builds. (thanks @madcapnmckay)

* #39 - Fixed a capitalization issue with the require statement for commander. (thanks @tutukin)

## 0.7.8

Added support for relative import statements. (thanks @robertmesserle for helping with ideas and pushing me to get this done). Don't prefix the import path with a ./ or /, Anvil won't recognize that as a match.

### Examples of (now valid) import statements:

__To import a file in the same directory:__
	// import( "child.js" );

__To import a file from a subdirectory:__
	// import( "subdir/child.js" );

__To import a file from a parent directory:__
	// import( "../parent.js" );

__To import a file from a sibling directory:__
	// import( "../sibling/file.js" );


## 0.7.7

Removed support for docco since the flocco repository disappeared from NPM and GitHub. The original docco package requires python and a python package to be installed. This feels too heavy a requirement to install Anvil (which already has a lot of dependencies).

## 0.7.6

Addressed issues: #28, #29 and #30 (thanks @mikesten)

 * Fixed issues with the combiner's regular expressions that caused issues with jQuery's $
 * Fixed a bug in how the minification was mangling the creation of minified file names

## 0.7.5

###Issues
 * #18 - ENOENT error on creating project scaffold (thanks @mikehostetler and @ifandelse)
 * #22 - No longer copying files to user's ext folder. Anvil's browser dependencies (for QUnit support) are now available via relative url. (thanks @barclayadam)
 	* jquery -> /anvil/jquery.js
 	* qunit -> /anvil/qunit.js, /anvil/qunit.css
 	* pavlov -> /anvil/pavlov.js
 	* anvilHook -> /anvil/anvilHook.js
 * #23 - ENOENT was occurring and not caught in CI mode because of symbolic links (thanks @yesimon)

 ### Experimental Uglify Exclusions


 ### Parallel Development for Anvil 0.8.*

## 0.7.4

 * Added --help option to command line
 * Bug fix for Mocha in CI mode to force re-load of source files
 * Bug fix for CI mode that caused multiple builds to kick off on file change
 * CLI went from big ugly function to a proper module

## 0.7.3

 * Bug fix to prevent Anvil from trying to "BUILD ALL THE THINGS" when it had no idea how to process every file it found.