var fs = require('fs');
var assert = require('assert');
var sys = require('sys');

var Haml = require("../lib/haml");



function compare(haml_file, haml, expected, scope, options){
  options || (options = {});
  try {
    sys.puts(haml_file + " Begun")
    var js = Haml.compile(haml);
    var js_opt = Haml.optimize(js);
    var jsFn = Haml(haml, options);
    var actual = jsFn.call(scope.context, scope.locals);
               
    assert.equal(actual, expected);
    sys.puts(haml_file + " Passed")
    
    actual = Haml.render(haml, {context:scope.context, locals:scope.locals})
    
    assert.equal(actual, expected);
    sys.puts(haml_file + " Haml.render Passed")
    
  } catch (e) {
    var message = e.name;
    if (e.message) { message += ": " + e.message; }
    sys.error(haml_file + " FAILED")
    sys.error(message);
    sys.error("\nJS:\n\n" + js);
    sys.error("\nOptimized JS:\n\n" + js_opt);
    sys.error("\nJS fn:\n\n"+jsFn.toString());
    sys.error("\nStack:\n\n"+e.stack);
    try{
      sys.error("\nActual["+actual.length+"]:\n\n" + actual);
      sys.error("\nExpected["+expected.length+"]:\n\n" + expected);
    }catch(e2){}
    
    process.exit();
  }
}


fs.readdir('.', function (err, files) {
  files.forEach(function (haml_file) {
    var m = haml_file.match(/^(.*)\.haml/),
        base;
    if (!m) {
      return;
    }
    base = m[1];

    function load_haml(scope) {
      fs.readFile(haml_file, "utf8", function (err, haml) {
        fs.readFile(base + ".html", "utf8", function (err, expected) {
          compare(haml_file, haml, expected, scope)
        });
      });
    }

    // Load scope
    if (files.indexOf(base + ".js") >= 0) {
      fs.readFile(base + ".js", "utf8", function (err, js) {
        load_haml(eval("(" + js + ")"));
      });
    } else {
      load_haml({});
    }
  });
});

(function(){
  var hamlSrc = fs.readFileSync("alt_attribs.haml", "utf8");
  var includeEscape = Haml(hamlSrc).toString();
  var customEscape = Haml(hamlSrc, {customEscape:"$esc"}).toString();
  try{
    assert.ok(customEscape.length < includeEscape.length);
  }catch(e){
    sys.error(e.stack);
    sys.error(customEscape);
    process.exit();
  }
})();


(function(){
  var hamlSrc = fs.readFileSync("./other/custom_escape.haml", "utf8");
  var expected = fs.readFileSync("./other/custom_escape.html", "utf8");
  var scope = eval("(" + fs.readFileSync("escaping.js") + ")");
  
  sys.puts("custom_escape" + " Begun")
  var jsFn = Haml(hamlSrc, {customEscape:"$esc"});
  
  this.$esc = function(){
    return "moo"
  };
  
  var actual = jsFn.call(scope.context, scope.locals); 
  try{           
    assert.equal(actual, expected);
  }catch(e){
    sys.error("\nActual["+actual.length+"]:\n\n" + actual);
    sys.error("\nExpected["+expected.length+"]:\n\n" + expected);
    process.exit();
  }
  sys.puts("custom_escape" + " Passed")
  
})();


(function(){
  var hamlSrc = fs.readFileSync("./other/escape_by_default.haml", "utf8");
  var expected = fs.readFileSync("./other/escape_by_default.html", "utf8");
  var scope = {};
  
  sys.puts("escape_by_default" + " Begun")
  var js = Haml.compile(hamlSrc);  
  
  var jsFn = Haml(hamlSrc, {escapeHtmlByDefault:true});
  
  this.$esc = function(){
    return "moo"
  };
  
  var actual = jsFn.call(scope.context, scope.locals); 
  try{           
    assert.equal(actual, expected);
  }catch(e){
    sys.error("\nActual["+actual.length+"]:\n\n" + actual);
    sys.error("\nExpected["+expected.length+"]:\n\n" + expected);
    process.exit();
  }
  sys.puts("escape_by_default" + " Passed")
  
})();

