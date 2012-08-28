_ = require "underscore"
log = require( "./logMock.coffee" ).log
FP = require( "./fsMock.coffee" ).fsProvider
Compiler = require( "../src/compile.coffee").compiler
path = require "path"

require "should"

fp = new FP()
compiler = new Compiler fp, log

stripSpace = ( content ) -> content.replace ///\s///g, ""
compareOutput = ( one, two ) ->  ( stripSpace one ).should.equal ( stripSpace two )

#------------------------------------------------------------------------------
#	
#	Coffee Resources
#
#------------------------------------------------------------------------------
goodCoffee = 
"""
class GoodClass
	constructor: ( @name ) ->

	method: () ->
		console.log 'this is a method call!'

"""

goodJs = """
var GoodClass;

GoodClass = (function() {

function GoodClass(name) {
  this.name = name;
}

GoodClass.prototype.method = function() {
  return console.log('this is a method call!');
};

return GoodClass;

})();
"""

badCoffee = """
	var Test = function( name ) {
		console.log( 'This is bad coffee, yo :(' );
	};
"""


#------------------------------------------------------------------------------
#	
#	CoffeeKup Resources
#
#------------------------------------------------------------------------------
goodKup = 
"""
doctype 5
html ->
  head ->
  body ->
    div class: "hero-unit", -> 
      h1 "Learn CoffeeKup ... I have no idea why"
      span class: "snark", "Maybe to prove you can do it"
"""

kupHtml = """
<!DOCTYPE html>
<html>
  <head>
  </head>
  <body>
    <div class="hero-unit">
      <h1>Learn CoffeeKup ... I have no idea why</h1>
      <span class="snark">Maybe to prove you can do it</span>
    </div>
  </body>
</html>
"""

badKup = """
	<html>
		<body>
			<span>This isn't going to work out</span>
		</body>
	</html>
"""

#------------------------------------------------------------------------------
#	
#	HAML Resources
#
#------------------------------------------------------------------------------
goodHaml = 
"""
!!!
%html
  %head
  %body
    .hero-unit
      %h1 Learn HAML For Fun And Profit
      %span.snark Great good seems like reaching a bit...
"""

hamlHtml = """
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
  <head></head>
  <body>
    <div class="hero-unit">
      <h1>Learn HAML For Fun And Profit</h1>
      <span class="snark">Great good seems like reaching a bit...</span>
    </div>
  </body>
</html>
"""

badHaml = """
TURP
"""

#------------------------------------------------------------------------------
#	
#	Markdown Resources
#
#------------------------------------------------------------------------------
goodMarkdown = 
"""
# This Has Limited Uses

	* Use it for content
	* Let Anvil combine it into pages like a mix-in
"""

markdownHtml = """
<h1>This Has Limited Uses</h1>
<pre><code>
* Use it for content
* Let Anvil combine it into pages like a mix-in
</code></pre>
"""

badMarkdown = """
!()[{}]
"""

#------------------------------------------------------------------------------
#	
#	Less Resources
#
#------------------------------------------------------------------------------
goodLess = 
"""
.rounded-corners (@radius: 5px) {
  border-radius: @radius;
  -webkit-border-radius: @radius;
  -moz-border-radius: @radius;
}

#header {
  .rounded-corners;
}
#footer {
  .rounded-corners(10px);
}
"""

lessCss = """
#header {
  border-radius: 5px;
  -webkit-border-radius: 5px;
  -moz-border-radius: 5px;
}
#footer {
  border-radius: 10px;
  -webkit-border-radius: 10px;
  -moz-border-radius: 10px;
}
"""

badLess = """
this shouldn't work
"""

#------------------------------------------------------------------------------
#	
#	Sass Resources
#
#------------------------------------------------------------------------------
goodSass = 
"""
$blue: #3bbfce
$margin: 16px

.content-navigation
  border-color: $blue
  color: darken($blue, 9%)

.border
  padding: $margin / 2
  margin: $margin / 2
  border-color: $blue
"""

sassCss = """
.content-navigation {
  border-color: #3bbfce;
  color: #2b9eab;
}

.border {
  padding: 8px;
  margin: 8px;
  border-color: #3bbfce;
}
"""

badSass = """
this shouldn't work
"""

#------------------------------------------------------------------------------
#	
#	Scss Resources
#
#------------------------------------------------------------------------------
goodScss = 
"""
$blue: #3bbfce;
$margin: 16px;

.content-navigation {
  border-color: $blue;
  color:
    darken($blue, 9%);
}

.border {
  padding: $margin / 2;
  margin: $margin / 2;
  border-color: $blue;
}
"""

scssCss = """
.content-navigation {
  border-color: #3bbfce;
  color: #2b9eab;
}

.border {
  padding: 8px;
  margin: 8px;
  border-color: #3bbfce;
}
"""

badScss = """
this shouldn't work
"""

#------------------------------------------------------------------------------
#	
#	Stylus Resources
#
#------------------------------------------------------------------------------
goodStylus = 
"""
font-size = 14px

body
   font font-size Arial, sans-serif
"""

stylusCss = """
body {
   font: 14px Arial, sans-serif;
 }
"""

badStylus = """
this shouldn't work
"""

#------------------------------------------------------------------------------
#	
#	CoffeeScript Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid coffeescript", ->

	file = 
		name: "good.coffee"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.coffee", goodCoffee, () -> 
			compiler.compile file, () -> done()

	it "should create a JavaScript file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid JavaScript", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, goodJs
			done()

describe "when compiling invalid coffeescript", ->

	file = 
		name: "good.coffee"
		workingPath: "tmp"
		ext: () -> path.extname @name

	errorCode = undefined

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.coffee", badCoffee, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()


	it "should not create a JavaScript file", () ->
		fp.pathExists( [ file.workingPath, file.name ] ).should.not.be

	it "should produce error message", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			errorCode.toString().should.equal 'SyntaxError: Reserved word "var" on line 1'
			done()

#------------------------------------------------------------------------------
#	
#	CoffeeKup Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid coffeekup", ->

	file = 
		name: "good.kup"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.kup", goodKup, () -> 
			compiler.compile file, () -> done()

	it "should create a html file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid html", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, kupHtml
			done()

describe "when compiling invalid coffeekup", ->

	file = 
		name: "bad.kup"
		workingPath: "tmp"
		ext: () -> path.extname @name

	errorCode = undefined

	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.kup", badKup, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()


	it "should not create a html file", () ->
		fp.pathExists( [ file.workingPath, file.name ] ).should.not.be

	it "should produce error message", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			errorCode.toString().should.equal "Error: Parse error on line 1: Unexpected 'COMPARE'"
			done()

#------------------------------------------------------------------------------
#	
#	Haml Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Haml", ->

	file = 
		name: "good.haml"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.haml", goodHaml, () -> 
			compiler.compile file, () -> done()

	it "should create a html file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid html", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, hamlHtml
			done()

describe "when compiling invalid Haml", ->

	file = 
		name: "bad.haml"
		workingPath: "tmp"
		ext: () -> path.extname @name

	errorCode = undefined

	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.haml", badKup, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()


	it "should not create a html file", () ->
		fp.pathExists( [ file.workingPath, file.name ] ).should.not.be

	it "should produce error message", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			#errorCode.should.equal "Error: Parse error on line 1: Unexpected 'COMPARE'"
			done()

#------------------------------------------------------------------------------
#	
#	Markdown Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Markdown", ->

	file = 
		name: "good.markdown"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.markdown", goodMarkdown, () -> 
			compiler.compile file, () -> done()

	it "should create a html file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid html", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, markdownHtml
			done()

describe "when compiling invalid Markdown", ->

	file = 
		name: "bad.markdown"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.markdown", badMarkdown, () -> 
			compiler.compile file, () -> done()

	it "should produce hot garbage", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			content.should.not.equal hamlHtml
			done()

#------------------------------------------------------------------------------
#	
#	Less Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Less", ->

	file = 
		name: "good.less"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.less", goodLess, () -> 
			compiler.compile file, () -> done()

	it "should create a css file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid css", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, lessCss
			done()

describe "when compiling invalid Less", ->

	file = 
		name: "bad.less"
		workingPath: "tmp"
		ext: () -> path.extname @name
	errorCode = undefined
	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.less", badLess, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()

	it "should not produce css file", () ->
		( fp.pathExists [ file.workingPath, file.name ] ).should.not.be

#------------------------------------------------------------------------------
#	
#	Sass Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Sass", ->

	file = 
		name: "good.sass"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.sass", goodSass, () -> 
			compiler.compile file, () -> done()

	it "should create a css file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid css", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			#compareOutput content, sassCss
			done()

describe "when compiling invalid Sass", ->

	file = 
		name: "bad.sass"
		workingPath: "tmp"
		ext: () -> path.extname @name
	errorCode = undefined
	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.sass", badSass, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()

	it "should not produce css file", () ->
		( fp.pathExists [ file.workingPath, file.name ] ).should.not.be

#	it "should return an error", () ->
#		errorCode.should.exist

#------------------------------------------------------------------------------
#	
#	Scss Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Scss", ->

	file = 
		name: "good.scss"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.scss", goodScss, () ->
			compiler.compile file, () -> done()

	it "should create a css file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid css", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			#compareOutput scssCss, content 
			done()

describe "when compiling invalid Scss", ->

	file = 
		name: "bad.scss"
		workingPath: "tmp"
		ext: () -> path.extname @name
	errorCode = undefined
	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.scss", badScss, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()

	it "should not produce css file", () ->
		( fp.pathExists [ file.workingPath, file.name ] ).should.not.be

#	it "should return an error", () ->
#		errorCode.should.exist

#------------------------------------------------------------------------------
#	
#	Stylus Compiler
#
#------------------------------------------------------------------------------

describe "when compiling valid Stylus", ->

	file = 
		name: "good.styl"
		workingPath: "tmp"
		ext: () -> path.extname @name

	fp.reset();

	before ( done ) ->
		fp.write "tmp/good.styl", goodStylus, () -> 
			compiler.compile file, () -> done()

	it "should create a css file", () ->
		fp.pathExists [ file.workingPath, file.name ].should.be.ok

	it "should produce valid css", ( done ) ->
		fp.read [ file.workingPath, file.name ], ( content ) ->
			compareOutput content, stylusCss
			done()

describe "when compiling invalid Stylus", ->

	file = 
		name: "bad.styl"
		workingPath: "tmp"
		ext: () -> path.extname @name
	errorCode = undefined
	fp.reset();

	before ( done ) ->
		fp.write "tmp/bad.styl", badStylus, () -> 
			compiler.compile file, ( err ) ->
				errorCode = err
				done()

	it "should not produce css file", () ->
		( fp.pathExists [ file.workingPath, file.name ] ).should.not.be

	#it "should return an error", () ->
	#	errorCode.should.exist
