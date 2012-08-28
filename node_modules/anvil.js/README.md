# Anvil

Anvil started as a way to build a single javascript module from several source files. Build tools that require a lot of explicit/declarative instructions distract from getting work on the project done.

Anvil is currently being rewritten as CI tool for JS, CSS and HTML.

## What Does It Do?

Here are the main features:

* Create simple directory structure / scaffolding for new projects
* Combine resource files through a comment-based import syntax
* 'Compile' CoffeeScript, Stylus, LESS, HAML, and Markdown
* Minify JS and CSS resources
* Generate annotated JS or CoffeeScript source with docco or ape
* Continously perform these steps in the background as files change
* Mocha test runner
* Host static content
 * Compiles CoffeeScript, Stylus, LESS, Markdown and HAML on the fly
 * Useful for hosting browser test suites
 * Simple hook script to cause page refreshes after every build

## Installation

    npm install anvil.js -g

## By Convention

Without a build file, Anvil will use its default conventions to attempt to build your project.

## The Build File ( large example showing lots of options )

    {
        "source": "src",
        "style": "style",
        "markup": "markup",
        "output": {
            "source": [ "lib", "site/js" ],
            "style": [ "css", "site/css" ],
            "markup": "site/"
        },
        "lint": {},
        "uglify": {},
        "cssmin": {},
        "extensions": { "uglify": "min" },
        "finalize": {
            "header|header-file": "this is some unprocessed text or a file name",
            "footer|footer-file": "this is some unprocessed text or a file name"
        },
        "wrap": {
            "prefix|prefix-file": "this is some unprocessed text or a file name",
            "suffix|suffix-file": "this is some unprocessed text or a file name"
        },
        "hosts": {
          "/": "site",
          "/docs": "docs"
        },
        "name": "custom-name.js",
        "mocha": { "reporter": "spec" },
        "docs": { "generator": "ape", "output": "docs" }
    }

* source is your JS and CS code.
* output is where build outputs go.
* lint will run output files run through JSLint before Uglify occurs (JS only).
* uglify specifies that you want your JS output uglified.
* cssmin minifies CSS output.
* wrap
    * happens before minification
    * provides a means to wrap all output files of a type with a prefix and suffix before minification
    * if prefix-file or suffix-file is provided, the file will be read and the contents used
    * this feature is primarily a convenience method included for legacy reasons
* finalize
    * header prepends the following string to the final output ONLY.
    * footer appends the following string to the final output ONLY.
    * if header-file or footer-file is provided, the file will be read and the contents used
    * this section was added to support adding boiler plate text headers to minified/gzipped output
* name
    * for projects with a single file output, this will replace the name of the output file
    * for projects with multiple file outputs, you can provide a lookup hash to over-write
        each specific file name
* mocha
	* allows you to provide customizations to how the mocha tests will run
 * docs
 	* generate annotated source documents for your project

## Jumpstart New Projects

There are two ways to do this now - one for lib projects and one for sites.

Anvil will build a set of standard project directories for you and even spit out a build.json file based on the conventional use.

### Lib Projects

    anvil --lib <projectName>

Will produce a directory structure that looks like this:

    -projectName
        |-ext
        |-src
        |-lib
        |-spec
        build.json


### Site Projects

    anvil --site <projectName>

Will produce a directory structure that looks like this:

    -projectName
        |-ext
        |-src
        |-site
            |-js
            |-css
        |-style
        |-markup
        |-lib
        |-css
        |-spec
        build.json

## Building By Convention

If you don't specify your own build file, anvil assumes you intend to use a build.json file. If one isn't present, it will use its own conventions to build your project. If that's all you need, great! Chances are you'll want a build.json that's configured for your specific project. 

Now that there are two types of projects, Anvil infers the project type based on the folders you have.

## Combining source files

Anvil allows you to combine source files by using a commented command

**Javascript**

    // import("dependency.{ext}");

**Coffeescript**

    ### import "dependency.{ext}" ###

**Stylus, LESS, CSS**

    CSS: 			/* import "dependency.{ext}" */ 
    LESS, Stylus:	// import "dependency.{ext}

When you use Anvil to compile your project, it will traverse all the files in your source directory and combine them so that your top level files are what get output. **Warning** Currently, Anvil is not clever enough to detect circular dependencies created via import statements and it will _shatter your world_ if you do this.

## Building With Specific Build Files

To build with a specific build file

    anvil -b <buildfile>

## Creating New / Additional Build Files

To create a build file for lib projects, you can just type the following:

    anvil --libfile <buildfile>

or for a site project

    anvil --sitefile <buildfile>

and it will create the build file for you. If you don't include the file name, anvil will create a build.json (possibly overwriting your existing one, be careful!)

## Custom Naming

For projects with a single file output, you can provide a name property which will override the default name of the file:

    "name": "my-custom-name.js"

For projects where there are multiple files in the output, you must provide a hash object that will tell anvil how to rename each specific file. For example, if you have a build producing 'one.js' and 'two.js' you would need to provide a hash object that would tell anvil how to name each:

    "name": {
        "one.js" : "main.js",
        "two.js" : "plugin.js"
    }

## Continuous Integration

Anvil will watch your source directory for changes and rebuild the project in the event any changes are saved to the files in the directory.

    anvil --ci

Remember, if you intend to always run in this mode, you can put a "continuous": true in your build.json file.

## Hosting

Anvil provides local hosting based on the "hosts" config block. Adding -h, --host argument or a "host": true block to your build.json file will cause Anvil to host your project's directories (according to configuration) at port 3080 via express.

    anvil -h

or

    anvil --host

Coffee, Stylus, LESS, Mardown, and HAML are all converted at request time if they are referenced directly.

The hosts key in the build.json file is where you can control what each folder will be hosted at in the relative url.

    "hosts": {
        "/example1" : "./examples/example1",
        "/example2" : "./examples/example2"
    }

The block above would host the folder ./example/example1 at http://localhost:3080/example1 and folder ./example/example2 at http://localhost:3080/example2

### External Dependencies

External dependencies get included in all hosting scenarios.

### Testing With Mocha

Mocha might be the best thing ever. You can tell Anvil to run your spec files with mocha from the command line

    anvil --mocha

or by adding a "mocha" configuration block to your build.json file.

## Too chatty?

You can tell anvil to run in quiet mode (it will still print errors (red) and step completions (green) )

    anvil -q

# Contributors

Special thanks to the following individuals who have contributed source code or ideas to help make Anvil.js less buggy and more useful:

 * Jim Cowart
 * Aaron McCall
 * Mike Stenhouse
 * Robert Messerle
 * Mike Hostetler
 * Doug Neiner
 * Derick Bailey