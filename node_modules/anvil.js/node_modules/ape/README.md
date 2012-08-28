ape
===

API docs? Nope, ape docs!

ape generates API documentation in github-flavored-markup from comments in your code, and places them in line with the actual code. This allows for very easy integration with github.
Optionally, ape can also output to html with a built-in jade template, or one you specify.


See lib/template.jade for an example template, lib/ape.html and lib/ape.md are example output.

To install:

    sudo npm install -g ape

And how to use: 

    Usage: node ./bin/ape [input file|directory list]

    Options:
      --md            Output as markdown        [boolean]  [default: true]
      --html          Output as HTML            [boolean]  [default: false]
      --template, -t  Template for HTML output  [string]
      --output, -o    Output directory          [string]

Currently python, javascript, ruby, lua, coffeescript, C, C++, Perl, PHP, C#, ObjC, SQL, Bash, CSS, and ActionScript are supported. Feel free to submit a pull request for additional languages!
