/*-----------------------------------------------------------------------------
 *	Anvil.JS v0.7.8
 *  Copyright (c) 2011-2012 Alex Robson
 *
 *	Permission is hereby granted, free of charge, to any person obtaining a 
 *	copy of this software and associated documentation files (the "Software"), 
 *	to deal in the Software without restriction, including without limitation 
 *	the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 *	and/or sell copies of the Software, and to permit persons to whom the 
 *	Software is furnished to do so, subject to the following conditions:
 *
 *	The above copyright notice and this permission notice shall be included in 
 *	all copies or substantial portions of the Software.
 *
 *	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 *	OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL 
 *	THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 *	FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 *	DEALINGS IN THE SOFTWARE.
 *---------------------------------------------------------------------------*/
var Anvil, Cli, Combiner, Commander, Compiler, Configuration, Context, Continuous, Documenter, FSCrawler, FSProvider, Host, Log, MarkupPipeline, Mocha, MochaRunner, PostProcessor, Runner, Scheduler, SocketServer, SourcePipeline, StylePipeline, Suite, ape, coffeeKup, coffeeScript, colors, config, continuous, cssminifier, debug, defaultDoc, defaultMocha, emitter, events, express, ext, extensionLookup, fs, haml, inProcess, interfaces, jslint, jsp, less, libConfig, log, marked, mkdir, path, pro, quiet, reporters, siteConfig, stylus, test, _;
events = require("events");
emitter = events.EventEmitter;
_ = require("underscore");
colors = require("colors");
fs = require("fs");
mkdir = require("mkdirp").mkdirp;
path = require("path");
express = require("express");
Log = (function() {
  function Log() {}
  Log.prototype.onEvent = function(x) {
    if (!quiet) {
      return console.log("   " + x);
    }
  };
  Log.prototype.onStep = function(x) {
    if (!quiet) {
      return console.log(("" + x).blue);
    }
  };
  Log.prototype.onComplete = function(x) {
    return console.log(("" + x).green);
  };
  Log.prototype.onError = function(x) {
    return console.log(("!!! " + x + " !!!").red);
  };
  return Log;
})();
log = new Log();
exports.log = log;
_ = require("underscore");
path = require("path");
Commander = require("commander").Command;
config = {};
siteConfig = {
  "source": "src",
  "style": "style",
  "markup": "markup",
  "output": {
    "source": ["lib", "site/js"],
    "style": ["css", "site/css"],
    "markup": "site/"
  },
  "spec": "spec",
  "ext": "ext",
  "lint": {},
  "uglify": {},
  "cssmin": {},
  "hosts": {
    "/": "site"
  }
};
libConfig = {
  "source": "src",
  "output": "lib",
  "spec": "spec",
  "ext": "ext",
  "lint": {},
  "uglify": {},
  "hosts": {
    "/": "spec"
  }
};
defaultMocha = {
  growl: true,
  ignoreLeaks: true,
  reporter: "spec",
  ui: "bdd",
  colors: true
};
defaultDoc = {
  generator: "docco",
  output: "docs"
};
continuous = test = inProcess = quiet = debug = false;
ext = {
  gzip: "gz",
  uglify: "min",
  cssmin: "min"
};
extensionLookup = {
  ".css": "style",
  ".scss": "style",
  ".sass": "style",
  ".less": "style",
  ".stylus": "style",
  ".js": "source",
  ".coffee": "source",
  ".markdown": "markup",
  ".md": "markup",
  ".html": "markup"
};
Configuration = (function() {
  function Configuration(fp, scheduler, log) {
    this.fp = fp;
    this.scheduler = scheduler;
    this.log = log;
  }
  Configuration.prototype.configure = function(argList, onConfig) {
    var buildFile, command, exists, name, scaffold, self, type;
    self = this;
    command = new Commander();
    command.version("0.7.7").option("-b, --build [build file]", "Use a custom build file", "./build.json").option("--ci", "Run a continuous integration build").option("--host", "Setup a static HTTP host").option("--lib [project]", "Create a lib project at the folder [project]").option("--libfile [file name]", "Create a new lib build file named [file name]").option("--site [project]", "Create a site project at the folder [project]").option("--sitefile [file name]", "Create a new site build file named [file name]").option("--mocha", "Run specifications using Mocha").option("--ape", "Create annotated source using ape").option("-q, --quiet", "Only print completion and error messages");
    command.parse(argList);
    if (command.libfile || command.sitefile) {
      name = command.libfile || (command.libfile = command.sitefile);
      type = command.sitefile ? 'site' : 'lib';
      return this.writeConfig(type, "" + name + ".json", function() {
        self.log.onComplete("Created " + type + " build file - " + name);
        return onConfig(config, true);
      });
    } else if (command.site || command.lib) {
      type = command.site ? 'site' : 'lib';
      scaffold = command.site || (command.site = command.lib);
      config = type === 'site' ? siteConfig : libConfig;
      this.log.onStep("Creating scaffolding for new " + type + " project");
      return self.ensurePaths(function() {
        return self.writeConfig(type, scaffold + "/build.json", function() {
          self.log.onComplete("Scaffold ( " + scaffold + " ) created.");
          return onConfig(config, true);
        });
      }, scaffold);
    } else {
      buildFile = command.build;
      this.log.onStep("Checking for " + buildFile);
      exists = this.fp.pathExists(buildFile);
      return this.prepConfig(exists, buildFile, function() {
        if (command.host) {
          config.host = true;
        }
        if (command.ci) {
          config.continuous = true;
        }
        if (command.mocha) {
          config.mocha = defaultMocha;
        }
        if (command.ape) {
          config.docs = defaultDoc;
          config.docs.generator = "ape";
        }
        if (command.docco) {
          config.docs = defaultDoc;
        }
        return self.ensurePaths(function() {
          return onConfig(config);
        });
      });
    }
  };
  Configuration.prototype.createLibBuild = function() {
    var output;
    if (buildLibTemplate) {
      output = buildLibTemplate === true ? "build.json" : buildLibTemplate;
      writeConfig("lib", output);
      global.process.exit(0);
      return config;
    }
  };
  Configuration.prototype.createSiteBuild = function() {
    var output;
    if (buildSiteTemplate) {
      output = buildSiteTemplate === true ? "build.json" : buildSiteTemplate;
      writeConfig("site", output);
      global.process.exit(0);
      return config;
    }
  };
  Configuration.prototype.ensurePaths = function(onComplete, prefix) {
    var fp, name, nestedPath, nestedPaths, output, outputList, paths, self, worker, _i, _len;
    self = this;
    prefix = prefix || (prefix = "");
    config.working = config.working || "./tmp";
    fp = this.fp;
    paths = [config["source"], config["style"], config["markup"], config["spec"], config["ext"], config["working"]];
    if (config.docs) {
      paths.push(config.docs.output);
    }
    outputList = [];
    if (_.isObject(config.output)) {
      outputList = _.flatten(config.output);
    } else {
      outputList = [config.output];
    }
    paths = paths.concat(outputList);
    name = config.name;
    if (name) {
      for (_i = 0, _len = outputList.length; _i < _len; _i++) {
        output = outputList[_i];
        if (_.isString(name)) {
          nestedPath = path.dirname(name);
          if (nestedPath) {
            paths.push(path.join(output, nestedPath));
          }
        } else {
          nestedPaths = _.map(_.flatten(name), function(x) {
            return path.join(output, path.dirname(x));
          });
          paths = paths.concat(nestedPaths);
        }
      }
    }
    worker = function(p, done) {
      try {
        return fp.ensurePath([prefix, p], function() {
          return done();
        });
      } catch (err) {
        return done();
      }
    };
    this.log.onStep("Ensuring project directory structure");
    return this.scheduler.parallel(paths, worker, onComplete);
  };
  Configuration.prototype.prepConfig = function(exists, file, onComplete) {
    var onDone, self;
    self = this;
    onDone = function() {
      return self.normalizeConfig(onComplete);
    };
    if (!exists) {
      return this.loadConvention(onDone);
    } else {
      return this.loadConfig(file, onDone);
    }
  };
  Configuration.prototype.loadConfig = function(file, onComplete) {
    var fp;
    this.log.onStep("Loading config...");
    fp = this.fp;
    return fp.read(file, function(content) {
      config = JSON.parse(content);
      if (config.extensions) {
        ext.gzip = config.extensions.gzip || ext.gzip;
        ext.uglify = config.extensions.uglify || ext.uglify;
      }
      return onComplete();
    });
  };
  Configuration.prototype.loadConvention = function(onComplete) {
    var conventionConfig, isSite;
    isSite = this.fp.pathExists("./site");
    conventionConfig = isSite ? siteConfig : libConfig;
    this.log.onStep("No build file found, using " + (isSite ? 'site' : 'lib') + " conventions");
    config = conventionConfig;
    return onComplete();
  };
  Configuration.prototype.normalizeConfig = function(onComplete) {
    var calls, finalize, fp, outputPath, self, wrap;
    self = this;
    fp = this.fp;
    config.output = config.output || "lib";
    if (_.isString(config.output)) {
      outputPath = config.output;
      config.output = {
        style: outputPath,
        source: outputPath,
        markup: outputPath
      };
    }
    calls = [];
    finalize = config.finalize;
    if (finalize) {
      calls.push(function(done) {
        return self.getFinalization(finalize, function(result) {
          config.finalize = result;
          return done();
        });
      });
    }
    wrap = config.wrap;
    if (wrap) {
      calls.push(function(done) {
        return self.getWrap(wrap, function(result) {
          config.wrap = result;
          return done();
        });
      });
    }
    if (config.mocha) {
      config.mocha = _.extend(defaultMocha, config.mocha);
    }
    if (config.docs) {
      config.docs = _.extend(defaultDoc, config.docs);
    }
    if (calls.length > 0) {
      return this.scheduler.parallel(calls, function(call, done) {
        return call(done);
      }, function() {
        return onComplete();
      });
    } else {
      return onComplete();
    }
  };
  Configuration.prototype.getFinalization = function(original, onComplete) {
    var aggregate, aggregation, blocks, finalization, result, self, sources;
    self = this;
    finalization = {};
    result = {};
    aggregation = {};
    aggregate = this.scheduler.aggregate;
    if (!original || _.isEqual(original, {})) {
      return onComplete(finalization);
    } else if (original.header || original["header-file"] || original.footer || original["footer-file"]) {
      this.getContentBlock(original, "header", aggregation);
      this.getContentBlock(original, "footer", aggregation);
      if (_.isEqual(aggregation, {})) {
        return onComplete(finalization);
      } else {
        return aggregate(aggregation, function(constructed) {
          finalization.source = constructed;
          return onComplete(finalization);
        });
      }
    } else {
      sources = {};
      blocks = {
        "source": original["source"],
        "style": original["style"],
        "markup": original["markup"]
      };
      _.each(blocks, function(block, name) {
        var subAggregate;
        subAggregate = {};
        self.getContentBlock(block, "header", subAggregate);
        self.getContentBlock(block, "footer", subAggregate);
        return sources[name] = function(done) {
          return aggregate(subAggregate, done);
        };
      });
      return aggregate(sources, onComplete);
    }
  };
  Configuration.prototype.getWrap = function(original, onComplete) {
    var aggregate, aggregation, blocks, result, self, sources, wrap;
    self = this;
    wrap = {};
    result = {};
    aggregation = {};
    aggregate = this.scheduler.aggregate;
    if (!original || _.isEqual(original, {})) {
      return onComplete(wrap);
    } else if (original.prefix || original["prefix-file"] || original.suffix || original["suffix-file"]) {
      this.getContentBlock(original, "prefix", aggregation);
      this.getContentBlock(original, "suffix", aggregation);
      if (_.isEqual(aggregation, {})) {
        return onComplete(wrap);
      } else {
        return aggregate(aggregation, function(constructed) {
          wrap.source = constructed;
          return onComplete(wrap);
        });
      }
    } else {
      sources = {};
      blocks = {
        "source": original["source"],
        "style": original["style"],
        "markup": original["markup"]
      };
      _.each(blocks, function(block, name) {
        var subAggregate;
        subAggregate = {};
        self.getContentBlock(block, "prefix", subAggregate);
        self.getContentBlock(block, "suffix", subAggregate);
        return sources[name] = function(done) {
          return aggregate(subAggregate, done);
        };
      });
      return aggregate(sources, onComplete);
    }
  };
  Configuration.prototype.getContentBlock = function(source, property, aggregation) {
    var fp, propertyPath, propertyValue;
    aggregation[property] = function(done) {
      return done("");
    };
    fp = this.fp;
    if (source) {
      propertyPath = source["" + property + "-file"];
      propertyValue = source[property];
      if (propertyPath && this.fp.pathExists(propertyPath)) {
        return aggregation[property] = function(done) {
          return fp.read(propertyPath, function(content) {
            return done(content);
          });
        };
      } else if (propertyValue) {
        return aggregation[property] = function(done) {
          return done(propertyValue);
        };
      }
    }
  };
  Configuration.prototype.writeConfig = function(type, name, onComplete) {
    var json;
    config = type === "lib" ? libConfig : siteConfig;
    log = this.log;
    json = JSON.stringify(config, null, "\t");
    return this.fp.write(name, json, function() {
      log.onComplete("" + name + " created successfully!");
      return onComplete();
    });
  };
  return Configuration;
})();
exports.configuration = Configuration;
_ = require("underscore");
Scheduler = (function() {
  function Scheduler() {}
  Scheduler.prototype.parallel = function(items, worker, onComplete) {
    var count, done, item, results, _i, _len, _results;
    if (!items || items.length === 0) {
      onComplete([]);
    }
    count = items.length;
    results = [];
    done = function(result) {
      count = count - 1;
      if (result) {
        results.push(result);
      }
      if (count === 0) {
        return onComplete(results);
      }
    };
    _results = [];
    for (_i = 0, _len = items.length; _i < _len; _i++) {
      item = items[_i];
      _results.push(worker(item, done));
    }
    return _results;
  };
  Scheduler.prototype.pipeline = function(item, workers, onComplete) {
    var done, iterate;
    if (item === void 0 || !workers || workers.length === 0) {
      onComplete(item || {});
    }
    iterate = function(done) {
      var worker;
      worker = workers.shift();
      return worker(item, done);
    };
    done = function() {};
    done = function(product) {
      item = product;
      if (workers.length === 0) {
        return onComplete(product);
      } else {
        return iterate(done);
      }
    };
    return iterate(done);
  };
  Scheduler.prototype.aggregate = function(calls, onComplete) {
    var getCallback, isDone, results;
    results = {};
    isDone = function() {
      return _.chain(calls).keys().all(function(x) {
        return results[x] !== void 0;
      }).value();
    };
    getCallback = function(name) {
      return function(result) {
        results[name] = result;
        if (isDone()) {
          return onComplete(results);
        }
      };
    };
    return _.each(calls, function(call, name) {
      var callback;
      callback = getCallback(name);
      return call(callback);
    });
  };
  return Scheduler;
})();
exports.scheduler = Scheduler;
fs = require("fs");
path = require("path");
_ = require("underscore");
FSCrawler = (function() {
  function FSCrawler(scheduler) {
    this.scheduler = scheduler;
    _.bindAll(this);
  }
  FSCrawler.prototype.crawl = function(directory, onComplete) {
    var fileList, forAll, self;
    self = this;
    fileList = [];
    forAll = this.scheduler.parallel;
    if (directory && directory !== "") {
      directory = path.resolve(directory);
      return fs.readdir(directory, function(err, contents) {
        var item, qualified, _i, _len;
        if (!err && contents.length > 0) {
          qualified = [];
          for (_i = 0, _len = contents.length; _i < _len; _i++) {
            item = contents[_i];
            qualified.push(path.resolve(directory, item));
          }
          return self.classifyHandles(qualified, function(files, directories) {
            fileList = fileList.concat(files);
            if (directories.length > 0) {
              return forAll(directories, self.crawl, function(files) {
                fileList = fileList.concat(_.flatten(files));
                return onComplete(fileList);
              });
            } else {
              return onComplete(fileList);
            }
          });
        } else {
          return onComplete(fileList);
        }
      });
    } else {
      return onComplete(fileList);
    }
  };
  FSCrawler.prototype.classifyHandles = function(list, onComplete) {
    if (list && list.length > 0) {
      return this.scheduler.parallel(list, this.classifyHandle, function(classified) {
        var directories, files, item, _i, _len;
        files = [];
        directories = [];
        for (_i = 0, _len = classified.length; _i < _len; _i++) {
          item = classified[_i];
          if (item.isDirectory) {
            directories.push(item.file);
          } else if (!item.error) {
            files.push(item.file);
          }
        }
        return onComplete(files, directories);
      });
    } else {
      return onComplete([], []);
    }
  };
  FSCrawler.prototype.classifyHandle = function(file, onComplete) {
    return fs.stat(file, function(err, stat) {
      if (err) {
        return onComplete({
          file: file,
          err: err
        });
      } else {
        return onComplete({
          file: file,
          isDirectory: stat.isDirectory()
        });
      }
    });
  };
  return FSCrawler;
})();
exports.crawler = FSCrawler;
fs = require("fs");
_ = require("underscore");
FSProvider = (function() {
  function FSProvider(crawler, log) {
    this.crawler = crawler;
    this.log = log;
    _.bindAll(this);
  }
  FSProvider.prototype.buildPath = function(pathSpec) {
    var fullPath;
    if (!pathSpec) {
      return "";
    } else {
      fullPath = pathSpec;
      if (_.isArray(pathSpec)) {
        fullPath = path.join.apply({}, pathSpec);
      }
      return fullPath;
    }
  };
  FSProvider.prototype["delete"] = function(filePath, onDeleted) {
    filePath = this.buildPath(filePath);
    if (this.pathExists(filePath)) {
      return fs.unlink(filePath, function(err) {
        return onDeleted();
      });
    }
  };
  FSProvider.prototype.ensurePath = function(pathSpec, onComplete) {
    pathSpec = this.buildPath(pathSpec);
    return path.exists(pathSpec, function(exists) {
      if (!exists) {
        return mkdir(pathSpec, "0755", function(err) {
          if (err) {
            return log.onError("Could not create " + pathSpec + ". " + err);
          } else {
            return onComplete();
          }
        });
      } else {
        return onComplete();
      }
    });
  };
  FSProvider.prototype.getFiles = function(filePath, onFiles) {
    var files;
    if (!filePath) {
      return onFiles([]);
    } else {
      filePath = this.buildPath(filePath);
      files = [];
      return this.crawler.crawl(filePath, onFiles);
    }
  };
  FSProvider.prototype.copy = function(from, to, onComplete) {
    var readStream, writeStream;
    from = this.buildPath(from);
    to = this.buildPath(to);
    readStream = void 0;
    writeStream = fs.createWriteStream(to);
    (readStream = fs.createReadStream(from)).pipe(writeStream);
    return readStream.on('end', function() {
      if (writeStream) {
        writeStream.destroySoon();
      }
      return onComplete();
    });
  };
  FSProvider.prototype.pathExists = function(pathSpec) {
    pathSpec = this.buildPath(pathSpec);
    return path.existsSync(pathSpec);
  };
  FSProvider.prototype.read = function(filePath, onContent) {
    filePath = this.buildPath(filePath);
    return fs.readFile(filePath, "utf8", function(err, content) {
      if (err) {
        log.onError("Could not read " + filePath + " : " + err);
        return onContent("", err);
      } else {
        return onContent(content);
      }
    });
  };
  FSProvider.prototype.readSync = function(filePath) {
    filePath = this.buildPath(filePath);
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (err) {
      log.onError("Could not read " + filePath + " : " + err);
      return err;
    }
  };
  FSProvider.prototype.transform = function(filePath, transform, outputPath, onComplete) {
    var self;
    self = this;
    filePath = this.buildPath(filePath);
    outputPath = this.buildPath(outputPath);
    return this.read(filePath, function(content) {
      return transform(content, function(newContent, error) {
        if (!error) {
          return self.write(outputPath, newContent, onComplete);
        } else {
          return onComplete(error);
        }
      });
    });
  };
  FSProvider.prototype.write = function(filePath, content, onComplete) {
    filePath = this.buildPath(filePath);
    return fs.writeFile(filePath, content, "utf8", function(err) {
      if (err) {
        log.onError("Could not write " + filePath + " : " + err);
        return onComplete(err);
      } else {
        return onComplete();
      }
    });
  };
  return FSProvider;
})();
exports.fsProvider = FSProvider;
coffeeScript = require("coffee-script");
less = require("less");
stylus = require("stylus");
haml = require("haml");
marked = require("marked");
marked.setOptions({
  sanitize: false
});
coffeeKup = require("coffeekup");
_ = require("underscore");
Compiler = (function() {
  function Compiler(fp, log) {
    this.fp = fp;
    this.log = log;
    _.bindAll(this);
  }
  Compiler.prototype.compile = function(file, onComplete) {
    var compiler, newExt, newFile, self;
    self = this;
    ext = file.ext();
    newExt = this.extensionMap[ext];
    newFile = file.name.replace(ext, newExt);
    log = this.log;
    log.onEvent("Compiling " + file.name + " to " + newFile);
    compiler = this.compilers[ext];
    if (compiler) {
      return this.fp.transform([file.workingPath, file.name], compiler, [file.workingPath, newFile], function(err) {
        if (!err) {
          file.name = newFile;
          return onComplete(file);
        } else {
          log.onError("Error compiling " + file.name + ": \r\n " + err);
          return onComplete(err);
        }
      });
    } else {
      return onComplete(file);
    }
  };
  Compiler.prototype.extensionMap = {
    ".js": ".js",
    ".css": ".css",
    ".html": ".html",
    ".coffee": ".js",
    ".kup": ".html",
    ".less": ".css",
    ".styl": ".css",
    ".sass": ".css",
    ".scss": ".css",
    ".haml": ".html",
    ".md": ".html",
    ".markdown": ".html"
  };
  Compiler.prototype.compilers = {
    ".coffee": function(content, onContent) {
      var js;
      try {
        js = coffeeScript.compile(content, {
          bare: true
        });
        return onContent(js);
      } catch (error) {
        return onContent("", error);
      }
    },
    ".less": function(content, onContent) {
      try {
        return less.render(content, {}, function(e, css) {
          return onContent(css);
        });
      } catch (error) {
        return onContent("", error);
      }
    },
    ".sass": function(content, onContent) {
      try {
        return onContent(content);
      } catch (error) {
        return onContent("", error);
      }
    },
    ".scss": function(content, onContent) {
      try {
        return onContent(content);
      } catch (error) {
        return onContent("", error);
      }
    },
    ".styl": function(content, onContent) {
      try {
        return stylus.render(content, {}, function(e, css) {
          return onContent(css, e);
        });
      } catch (error) {
        return onContent("", error);
      }
    },
    ".haml": function(content, onContent) {
      var html;
      try {
        html = haml.render(content);
        return onContent(html);
      } catch (error) {
        return onContent("", error);
      }
    },
    ".md": function(content, onContent) {
      try {
        return onContent(marked.parse(content));
      } catch (error) {
        return onContent("", error);
      }
    },
    ".markdown": function(content, onContent) {
      try {
        return onContent(marked.parse(content));
      } catch (error) {
        return onContent("", error);
      }
    },
    ".kup": function(content, onContent) {
      var html;
      try {
        html = (coffeeKup.compile(content, {}))();
        return onContent(html);
      } catch (error) {
        return onContent("", error);
      }
    }
  };
  return Compiler;
})();
exports.compiler = Compiler;
_ = require("underscore");
path = require("path");
Combiner = (function() {
  function Combiner(fp, scheduler, findPatterns, replacePatterns) {
    this.fp = fp;
    this.scheduler = scheduler;
    this.findPatterns = findPatterns;
    this.replacePatterns = replacePatterns;
  }
  Combiner.prototype.combineList = function(list, onComplete) {
    var combineFile, findDependents, findImports, forAll, self;
    self = this;
    forAll = this.scheduler.parallel;
    findImports = _.bind(function(file, done) {
      return self.findImports(file, list, done);
    }, this);
    findDependents = _.bind(function(file, done) {
      return self.findDependents(file, list, done);
    }, this);
    combineFile = _.bind(function(file, done) {
      return self.combineFile(file, done, this);
    });
    return forAll(list, findImports, function() {
      var f1, _i, _len;
      for (_i = 0, _len = list.length; _i < _len; _i++) {
        f1 = list[_i];
        findDependents(f1, list);
      }
      return forAll(list, combineFile, onComplete);
    });
  };
  Combiner.prototype.combineFile = function(file, onComplete) {
    var combineFile, dependencies, forAll, self;
    self = this;
    forAll = this.scheduler.parallel;
    if (file.combined) {
      return onComplete();
    } else {
      combineFile = function(file, done) {
        return self.combineFile(file, done);
      };
      dependencies = file.imports;
      if (dependencies && dependencies.length > 0) {
        return forAll(dependencies, combineFile, function() {
          return self.combine(file, function() {
            file.combined = true;
            return onComplete();
          });
        });
      } else {
        return self.combine(file, function() {
          file.combined = true;
          return onComplete();
        });
      }
    }
  };
  Combiner.prototype.findImports = function(file, list, onComplete) {
    var imports, self;
    self = this;
    imports = [];
    return this.fp.read([file.workingPath, file.name], function(content) {
      var importName, imported, importedFile, pattern, _i, _j, _len, _len2, _ref;
      _ref = self.findPatterns;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pattern = _ref[_i];
        imports = imports.concat(content.match(pattern));
      }
      imports = _.filter(imports, function(x) {
        return x;
      });
      for (_j = 0, _len2 = imports.length; _j < _len2; _j++) {
        imported = imports[_j];
        importName = (imported.match(/['\"].*['\"]/))[0].replace(/['\"]/g, "");
        importedFile = _.find(list, function(i) {
          var relativeImport, relativeImportPath;
          relativeImportPath = path.relative(path.dirname(file.fullPath), path.dirname(i.fullPath));
          relativeImport = self.fp.buildPath([relativeImportPath, i.name]);
          return relativeImport === importName;
        });
        file.imports.push(importedFile);
      }
      return onComplete();
    });
  };
  Combiner.prototype.findDependents = function(file, list) {
    var imported, item, _i, _len, _results;
    imported = function(importFile) {
      return file.fullPath === importFile.fullPath;
    };
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      item = list[_i];
      _results.push(_.any(item.imports, imported) ? file.dependents++ : void 0);
    }
    return _results;
  };
  Combiner.prototype.combine = function(file, onComplete) {
    var fp, imported, pipe, self, steps;
    self = this;
    if (!file.combined) {
      pipe = this.scheduler.pipeline;
      fp = this.fp;
      if (file.imports.length > 0) {
        steps = (function() {
          var _i, _len, _ref, _results;
          _ref = file.imports;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            imported = _ref[_i];
            _results.push(self.getStep(file, imported));
          }
          return _results;
        })();
        return fp.read([file.workingPath, file.name], function(main) {
          return pipe(main, steps, function(result) {
            return fp.write([file.workingPath, file.name], result, function() {
              return onComplete();
            });
          });
        });
      } else {
        return onComplete();
      }
    } else {
      return onComplete();
    }
  };
  Combiner.prototype.getStep = function(file, imported) {
    var self;
    self = this;
    return function(text, onDone) {
      return self.replace(text, file, imported, onDone);
    };
  };
  Combiner.prototype.replace = function(content, file, imported, onComplete) {
    var patterns, pipe, relativeImport, relativeImportPath, source, working;
    patterns = this.replacePatterns;
    pipe = this.scheduler.pipeline;
    source = imported.name;
    working = imported.workingPath;
    relativeImportPath = path.relative(path.dirname(file.fullPath), path.dirname(imported.fullPath));
    relativeImport = this.fp.buildPath([relativeImportPath, imported.name]);
    return this.fp.read([working, source], function(newContent) {
      var pattern, steps;
      steps = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = patterns.length; _i < _len; _i++) {
          pattern = patterns[_i];
          _results.push(function(current, done) {
            var capture, fullPattern, sanitized, stringified, whiteSpace;
            stringified = pattern.toString().replace(/replace/, relativeImport);
            stringified = stringified.substring(1, stringified.length - 2);
            fullPattern = new RegExp(stringified, "g");
            capture = fullPattern.exec(content);
            if (capture && capture.length > 1) {
              whiteSpace = capture[1];
              newContent = ("" + whiteSpace) + newContent.replace(/\n/g, "\n" + whiteSpace);
            }
            sanitized = current.replace(fullPattern, newContent.replace("\$", "$")).replace("$", "$");
            return done(sanitized);
          });
        }
        return _results;
      })();
      return pipe(content, steps, function(result) {
        return onComplete(result);
      });
    });
  };
  return Combiner;
})();
exports.combiner = Combiner;
jsp = require("uglify-js").parser;
pro = require("uglify-js").uglify;
jslint = require("readyjslint").JSLINT;
cssminifier = require("cssmin");
StylePipeline = (function() {
  function StylePipeline(config, fp, minifier, scheduler, log) {
    this.config = config;
    this.fp = fp;
    this.minifier = minifier;
    this.scheduler = scheduler;
    this.log = log;
    _.bindAll(this);
  }
  StylePipeline.prototype.process = function(files, onComplete) {
    var forAll, self;
    self = this;
    forAll = this.scheduler.parallel;
    return forAll(files, this.wrap, function() {
      var minified;
      minified = [];
      if (self.config.cssmin) {
        minified = _.map(files, function(x) {
          return _.clone(x);
        });
      }
      return forAll(files, self.finalize, function() {
        self.log.onStep("Finalizing CSS");
        return forAll(minified, self.minify, function() {
          if (minified.length > 0) {
            self.log.onStep("Minifying CSS");
          }
          return forAll(minified, self.finalize, function() {
            return onComplete(files.concat(minified));
          });
        });
      });
    });
  };
  StylePipeline.prototype.minify = function(file, onComplete) {
    var newFile, self;
    if (this.config.cssmin) {
      this.log.onEvent("Minifying " + file.name);
      self = this;
      ext = file.ext();
      newFile = file.name.replace(ext, ".min.css");
      return self.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        return onTransform(self.minifier.cssmin(content));
      }, [file.workingPath, newFile], function() {
        file.name = newFile;
        return onComplete();
      });
    } else {
      return onComplete();
    }
  };
  StylePipeline.prototype.finalize = function(file, onComplete) {
    var footer, header, self;
    self = this;
    if (this.config.finalize && this.config.finalize.style) {
      this.log.onEvent("Finalizing " + file.name);
      header = this.config.finalize.style.header;
      footer = this.config.finalize.style.footer;
      return this.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        if (header) {
          content = header + content;
        }
        if (footer) {
          content = content + footer;
        }
        return onTransform(content);
      }, [file.workingPath, file.name], onComplete);
    } else {
      return onComplete();
    }
  };
  StylePipeline.prototype.wrap = function(file, onComplete) {
    var prefix, self, suffix;
    self = this;
    if (this.config.wrap && this.config.wrap.style) {
      this.log.onEvent("Wrapping " + file.name);
      prefix = this.config.wrap.style.prefix;
      suffix = this.config.wrap.style.suffix;
      return this.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        if (prefix) {
          content = prefix + content;
        }
        if (suffix) {
          content = content + suffix;
        }
        return onTransform(content);
      }, [file.workingPath, file.name], onComplete);
    } else {
      return onComplete();
    }
  };
  return StylePipeline;
})();
SourcePipeline = (function() {
  function SourcePipeline(config, fp, minifier, scheduler, log) {
    this.config = config;
    this.fp = fp;
    this.minifier = minifier;
    this.scheduler = scheduler;
    this.log = log;
    _.bindAll(this);
  }
  SourcePipeline.prototype.process = function(files, onComplete) {
    var forAll, self;
    self = this;
    forAll = this.scheduler.parallel;
    return forAll(files, this.wrap, function() {
      var minify;
      minify = [];
      if (self.config.uglify) {
        minify = _.map(files, function(x) {
          return _.clone(x);
        });
      }
      return forAll(files, self.finalize, function() {
        self.log.onStep("Finalizing source files");
        return forAll(minify, self.minify, function() {
          if (minify.length > 0) {
            self.log.onStep("Minifying source files");
          }
          return forAll(minify, self.finalize, function() {
            return onComplete(files.concat(minify));
          });
        });
      });
    });
  };
  SourcePipeline.prototype.minify = function(file, onComplete) {
    var exclusions, isExcluded, newFile, self, _ref;
    exclusions = ((_ref = this.config.uglify) != null ? _ref.exclude : void 0) || [];
    isExcluded = _.any(exclusions, function(x) {
      return x === file.name;
    });
    if (this.config.uglify && !isExcluded) {
      self = this;
      ext = file.ext();
      newFile = file.name.replace(ext, ".min.js");
      this.log.onEvent("Minifying " + newFile);
      return this.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        return self.minifier(content, function(err, result) {
          if (err) {
            self.log.onError("Error minifying " + file.name + " : \r\n\t " + err);
            result = content;
          }
          return onTransform(result);
        });
      }, [file.workingPath, newFile], function() {
        file.name = newFile;
        return onComplete();
      });
    } else {
      return onComplete();
    }
  };
  SourcePipeline.prototype.finalize = function(file, onComplete) {
    var footer, header, self;
    self = this;
    if (this.config.finalize && this.config.finalize.source) {
      this.log.onEvent("Finalizing " + file.name);
      header = this.config.finalize.source.header;
      footer = this.config.finalize.source.footer;
      return this.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        if (header) {
          content = header + content;
        }
        if (footer) {
          content = content + footer;
        }
        return onTransform(content);
      }, [file.workingPath, file.name], function() {
        return onComplete();
      });
    } else {
      return onComplete();
    }
  };
  SourcePipeline.prototype.wrap = function(file, onComplete) {
    var prefix, self, suffix;
    self = this;
    if (this.config.wrap && this.config.wrap.source) {
      this.log.onEvent("Wrapping " + file.name);
      prefix = this.config.wrap.source.prefix;
      suffix = this.config.wrap.source.suffix;
      return this.fp.transform([file.workingPath, file.name], function(content, onTransform) {
        if (prefix) {
          content = prefix + content;
        }
        if (suffix) {
          content = content + suffix;
        }
        return onTransform(content);
      }, [file.workingPath, file.name], function() {
        return onComplete();
      });
    } else {
      return onComplete();
    }
  };
  return SourcePipeline;
})();
MarkupPipeline = (function() {
  function MarkupPipeline() {}
  return MarkupPipeline;
})();
PostProcessor = (function() {
  function PostProcessor(config, fp, scheduler, log) {
    var uglify;
    this.config = config;
    this.fp = fp;
    this.scheduler = scheduler;
    this.log = log;
    uglify = function(source, callback) {
      var ast;
      try {
        ast = jsp.parse(source);
        ast = pro.ast_mangle(ast);
        ast = pro.ast_squeeze(ast);
        return callback(void 0, pro.gen_code(ast));
      } catch (err) {
        return callback(err, "");
      }
    };
    this.style = new StylePipeline(this.config, this.fp, cssminifier, this.scheduler, this.log);
    this.source = new SourcePipeline(this.config, this.fp, uglify, this.scheduler, this.log);
    this.markup = {
      process: function(files, onComplete) {
        return onComplete(files);
      }
    };
  }
  return PostProcessor;
})();
exports.postProcessor = PostProcessor;
ape = require("ape");
Documenter = (function() {
  function Documenter(config, fp, scheduler, log) {
    var self;
    this.config = config;
    this.fp = fp;
    this.scheduler = scheduler;
    this.log = log;
    self = this;
    _.bindAll(this);
    if (this.config.docs) {
      this.generator = this.runApe;
    } else {
      this.generator = function() {
        var callback;
        callback = Array.prototype.slice.call(arguments, 4);
        if (callback) {
          return callback();
        }
      };
    }
  }
  Documenter.prototype.generate = function(files) {
    var self;
    self = this;
    if (files && files.length > 0) {
      this.log.onEvent("Creating annotated source for: " + (_.pluck(files, 'name').toString()));
      return this.scheduler.parallel(files, this.document, function() {
        return self.log.onComplete("Code annotation completed");
      });
    }
  };
  Documenter.prototype.document = function(file, onComplete) {
    var language, newFile, self;
    self = this;
    language = ape.get_language(file.name);
    ext = file.ext();
    newFile = file.name.replace(ext, ".html");
    this.log.onEvent("Annotation for " + file.name);
    return this.fp.read([file.workingPath, file.name], function(content) {
      return self.generator(language, ext, newFile, content, function(doc) {
        return self.fp.write([self.config.docs.output, newFile], doc, onComplete);
      });
    });
  };
  Documenter.prototype.runApe = function(language, extension, newFile, code, onComplete) {
    return ape.generate_doc(code, language, 'html', null, function(err, result) {
      return onComplete(result);
    });
  };
  return Documenter;
})();
Anvil = (function() {
  function Anvil(fp, compiler, combiner, documenter, scheduler, postProcessor, log, callback) {
    this.fp = fp;
    this.compiler = compiler;
    this.combiner = combiner;
    this.documenter = documenter;
    this.scheduler = scheduler;
    this.postProcessor = postProcessor;
    this.log = log;
    this.callback = callback;
    this.buildNumber = 0;
    this.inProcess = false;
  }
  Anvil.prototype.extensions = [".js", ".coffee", ".html", ".haml", ".markdown", ".md", ".css", ".styl", ".less", ".css"];
  Anvil.prototype.build = function(config) {
    if (!this.inProcess) {
      this.initialize(config);
      this.log.onStep("Build " + this.buildNumber + " initiated");
      this.inProcess = true;
      this.buildSource();
      return this.buildStyle();
    }
  };
  Anvil.prototype.buildMarkup = function() {
    var findPatterns, replacePatterns;
    findPatterns = [/[\<][!][-]{2}.?import[(]?.?['\"].*['\"].?[)]?.?[-]{2}[\>]/g];
    replacePatterns = [/([\t]*)[\<][!][-]{2}.?import[(]?.?['\"]replace['\"].?[)]?.?[-]{2}[\>]/g];
    return this.processType("markup", findPatterns, replacePatterns);
  };
  Anvil.prototype.buildSource = function() {
    var findPatterns, replacePatterns;
    findPatterns = [/([\/]{2}|[\#]{3}).?import.?[(]?.?[\"'].*[\"'].?[)]?[;]?.?([\#]{0,3})/g];
    replacePatterns = [/([\t]*)([\/]{2}|[\#]{3}).?import.?[(]?.?[\"']replace[\"'].?[)]?[;]?.?[\#]{0,3}/g];
    return this.processType("source", findPatterns, replacePatterns);
  };
  Anvil.prototype.buildStyle = function() {
    var findPatterns, replacePatterns;
    findPatterns = [/([\/]{2}|[\/][*]).?import[(]?.?[\"'].*[\"'].?[)]?([*][\/])?/g];
    replacePatterns = [/([\t]*)([\/]{2}|[\/][*]).?import[(]?.?[\"']replace[\"'].?[)]?([*][\/])?/g];
    return this.processType("style", findPatterns, replacePatterns);
  };
  Anvil.prototype.initialize = function(config) {
    this.config = config;
    this.filesBuilt = {};
    return this.steps = {
      source: false,
      style: false,
      markup: false,
      hasSource: config.source,
      hasStyle: config.style,
      hasMarkup: config.markup,
      markupReady: function() {
        return (this.source || !this.hasSource) && (this.style || !this.hasStyle);
      },
      allDone: function() {
        var status;
        status = (this.source || !this.hasSource) && (this.style || !this.hasStyle) && (this.markup || !this.hasMarkup);
        return status;
      }
    };
  };
  Anvil.prototype.processType = function(type, findPatterns, replacePatterns) {
    var combiner, compiler, forAll, postProcessor, self;
    self = this;
    forAll = this.scheduler.parallel;
    compiler = this.compiler;
    combiner = new this.combiner(this.fp, this.scheduler, findPatterns, replacePatterns);
    postProcessor = this.postProcessor;
    this.log.onStep("Starting " + type + " pipe-line");
    return self.prepFiles(type, function(list) {
      if (list && list.length > 0) {
        return self.copyFiles(list, function() {
          self.log.onStep("Combining " + type + " files");
          return combiner.combineList(list, function() {
            var final;
            final = _.filter(list, function(x) {
              return x.dependents === 0;
            });
            if (self.config.docs) {
              self.documenter.generate(final);
            }
            self.log.onStep("Compiling " + type + " files");
            return forAll(final, compiler.compile, function(compiled) {
              self.log.onStep("Post-process " + type + " files");
              return postProcessor[type].process(compiled, function(list) {
                self.log.onStep("Moving " + type + " files to destinations");
                return self.finalOutput(list, function() {
                  return self.stepComplete(type);
                });
              });
            });
          });
        });
      } else {
        return self.stepComplete(type);
      }
    });
  };
  Anvil.prototype.finalOutput = function(files, onComplete) {
    var copy, forAll, fp, names;
    fp = this.fp;
    names = this.config.name;
    forAll = this.scheduler.parallel;
    copy = function(file, done) {
      return forAll(file.outputPaths, function(destination, moved) {
        var custom, outputName;
        outputName = file.name;
        if (names) {
          if (_.isString(names)) {
            outputName = names;
          } else {
            custom = names[file.name];
            outputName = custom || (custom = outputName);
          }
        }
        return fp.copy([file.workingPath, file.name], [destination, outputName], moved);
      }, done);
    };
    return forAll(files, copy, onComplete);
  };
  Anvil.prototype.copyFiles = function(files, onComplete) {
    var copy, fp;
    fp = this.fp;
    copy = function(file, done) {
      return fp.ensurePath(file.workingPath, function() {
        return fp.copy(file.fullPath, [file.workingPath, file.name], done);
      });
    };
    return this.scheduler.parallel(files, copy, onComplete);
  };
  Anvil.prototype.cleanWorking = function(onComplete) {
    var forAll, fp;
    fp = this.fp;
    forAll = this.scheduler.parallel;
    return fp.getFiles(this.config.working, function(files) {
      return forAll(files, fp["delete"], function() {
        return onComplete();
      });
    });
  };
  Anvil.prototype.prepFiles = function(type, onComplete) {
    var output, self, typePath, workingBase;
    self = this;
    workingBase = this.config.working;
    typePath = this.config[type];
    output = this.config.output[type];
    output = _.isArray(output) ? output : [output];
    log = this.log;
    return this.fp.getFiles(typePath, function(files) {
      var file, filtered, list, name, relative, working;
      log.onEvent("Found " + files.length + " " + type + " files ...");
      list = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = files.length; _i < _len; _i++) {
          file = files[_i];
          name = path.basename(file);
          relative = path.dirname(file.replace(typePath, ""));
          working = self.fp.buildPath(workingBase, relative);
          _results.push({
            dependents: 0,
            ext: function() {
              return path.extname(this.name);
            },
            fullPath: file,
            imports: [],
            name: name,
            originalName: name,
            outputPaths: output,
            relativePath: relative,
            workingPath: working
          });
        }
        return _results;
      })();
      filtered = _.filter(list, function(x) {
        return _.any(self.extensions, function(y) {
          return y === x.ext();
        });
      });
      return onComplete(filtered);
    });
  };
  Anvil.prototype.stepComplete = function(step) {
    this.steps[step] = true;
    if (step !== "markup" && this.steps.markupReady()) {
      this.buildMarkup();
    }
    if (step === "markup" && this.steps.allDone()) {
      this.inProcess = false;
      return this.cleanWorking(this.callback);
    }
  };
  return Anvil;
})();
Continuous = (function() {
  function Continuous(fp, config, onChange) {
    this.fp = fp;
    this.config = config;
    this.onChange = onChange;
    this.style = this.normalize(this.config.style);
    this.source = this.normalize(this.config.source);
    this.markup = this.normalize(this.config.markup);
    this.spec = this.normalize(this.config.spec);
    this.watchers = [];
    this.watching = false;
    _.bindAll(this);
    this;
  }
  Continuous.prototype.normalize = function(x) {
    if (_.isArray(x)) {
      return x;
    } else {
      return [x];
    }
  };
  Continuous.prototype.setup = function() {
    var p, _i, _j, _k, _l, _len, _len2, _len3, _len4, _ref, _ref2, _ref3, _ref4, _results;
    if (!this.watching) {
      this.watching = true;
      if (this.style) {
        _ref = this.style;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          p = _ref[_i];
          this.watchPath(p);
        }
      }
      if (this.source) {
        _ref2 = this.source;
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          p = _ref2[_j];
          this.watchPath(p);
        }
      }
      if (this.markup) {
        _ref3 = this.markup;
        for (_k = 0, _len3 = _ref3.length; _k < _len3; _k++) {
          p = _ref3[_k];
          this.watchPath(p);
        }
      }
      if (this.spec) {
        _ref4 = this.spec;
        _results = [];
        for (_l = 0, _len4 = _ref4.length; _l < _len4; _l++) {
          p = _ref4[_l];
          _results.push(this.watchPath(p));
        }
        return _results;
      }
    }
  };
  Continuous.prototype.watchPath = function(path) {
    return this.fp.getFiles(path, this.watchFiles);
  };
  Continuous.prototype.watchFiles = function(files) {
    var file, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      file = files[_i];
      _results.push(this.watchers.push(fs.watch(file, this.onEvent)));
    }
    return _results;
  };
  Continuous.prototype.onEvent = function(event, file) {
    if (this.watching) {
      this.watching = false;
      while (this.watchers.length > 0) {
        this.watchers.pop().close();
      }
      return this.onChange();
    }
  };
  return Continuous;
})();
Mocha = require("mocha");
_ = require("underscore");
reporters = Mocha.reporters;
interfaces = Mocha.interfaces;
Context = Mocha.Context;
Runner = Mocha.Runner;
Suite = Mocha.Suite;
path = require("path");
/*
	This class is an adaptation of the code found in _mocha
	from TJ Holowaychuk's Mocha repository:
	https://github.com/visionmedia/mocha/blob/master/bin/_mocha
*/
MochaRunner = (function() {
  function MochaRunner(fp, scheduler, config, onComplete) {
    this.fp = fp;
    this.scheduler = scheduler;
    this.config = config;
    this.onComplete = onComplete;
    _.bindAll(this);
  }
  MochaRunner.prototype.run = function() {
    var forAll, mocha, opts, reporterName, self, specs, uiName, _base;
    self = this;
    if (this.config.spec) {
      forAll = this.scheduler.parallel;
      opts = (_base = this.config).mocha || (_base.mocha = {
        growl: true,
        ignoreLeaks: true,
        reporter: "spec",
        ui: "bdd",
        colors: true
      });
      reporterName = opts.reporter.toLowerCase().replace(/([a-z])/, function(x) {
        return x.toUpperCase();
      });
      uiName = opts.ui.toLowerCase();
      mocha = new Mocha({
        ui: uiName,
        ignoreLeaks: true,
        colors: opts.colors,
        growl: opts.growl,
        slow: opts.slow,
        timeout: opts.timeout
      });
      mocha.reporter(reporterName);
      specs = _.isString(this.config.spec) ? [this.config.spec] : this.config.spec;
      return forAll(specs, this.fp.getFiles, function(lists) {
        var file, files, _i, _len;
        files = _.flatten(lists);
        for (_i = 0, _len = files.length; _i < _len; _i++) {
          file = files[_i];
          delete require.cache[file];
          mocha.addFile(file);
        }
        return mocha.run(function() {
          return self.onComplete();
        });
      });
    }
  };
  return MochaRunner;
})();
SocketServer = (function() {
  function SocketServer(app) {
    _.bindAll(this);
    this.clients = [];
    this.io = require("socket.io").listen(app);
    this.io.set("log level", 1);
    this.io.sockets.on("connection", this.addClient);
  }
  SocketServer.prototype.addClient = function(socket) {
    this.clients.push(socket);
    socket.on("end", this.removeClient);
    socket.on("disconnect", this.removeClient);
    return log.onEvent("client connected");
  };
  SocketServer.prototype.removeClient = function(socket) {
    var index;
    index = this.clients.indexOf(socket);
    this.clients.splice(index, 1);
    return log.onEvent("client disconnected");
  };
  SocketServer.prototype.refreshClients = function() {
    log.onEvent("Refreshing hooked clients");
    return this.notifyClients("refresh");
  };
  SocketServer.prototype.notifyClients = function(msg) {
    var client, _i, _len, _ref, _results;
    _ref = this.clients;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      client = _ref[_i];
      _results.push(client.emit(msg, {}));
    }
    return _results;
  };
  return SocketServer;
})();
express = require('express');
Host = (function() {
  function Host(fp, scheduler, compiler, config) {
    var anvilPath, app, hosts, output, port, self, target;
    this.fp = fp;
    this.scheduler = scheduler;
    this.compiler = compiler;
    this.config = config;
    self = this;
    _.bindAll(this);
    this.app = express.createServer();
    app = this.app;
    app.use(express.bodyParser());
    app.use(app.router);
    hosts = this.config.hosts;
    if (hosts) {
      _.each(hosts, function(value, key) {
        return app.use(key, express.static(path.resolve(value)));
      });
    } else {
      output = this.config.output;
      target = "";
      if (this.config.markup) {
        if (_.isString(output)) {
          target = output;
        } else if (_.isArray(output)) {
          target = output[0];
        } else {
          target = output.markup;
        }
      } else {
        if (_.isString(output)) {
          target = output;
        } else if (_.isArray(output)) {
          target = output[0];
        } else {
          target = output.source;
        }
      }
      app.use("/", express.static(path.resolve(target)));
    }
    if (this.config.ext) {
      app.use("/ext", express.static(path.resolve(this.config.ext)));
    }
    if (this.config.spec) {
      app.use("/spec", express.static(path.resolve(this.config.spec)));
    }
    anvilPath = path.resolve(path.dirname(fs.realpathSync(__filename)), "../ext");
    console.log("Hosting anvil prerequisites from " + anvilPath);
    app.use("/anvil", express.static(anvilPath));
    app.get(/.*[.](coffee|kup|less|styl|md|markdown|haml)/, function(req, res) {
      var fileName, mimeType;
      fileName = "." + req.url;
      ext = path.extname(fileName);
      mimeType = self.contentTypes[ext];
      res.header('Content-Type', mimeType);
      return self.fp.read(fileName, function(content) {
        return self.compiler.compilers[ext](content, function(compiled) {
          return res.send(compiled);
        });
      });
    });
    port = this.config.port ? this.config.port : 3080;
    app.listen(port);
  }
  Host.prototype.contentTypes = {
    ".coffee": "application/javascript",
    ".less": "text/css",
    ".styl": "text/css",
    ".md": "text/html",
    ".markdown": "text/html",
    ".haml": "text/html",
    ".kup": "text/html"
  };
  return Host;
})();
Cli = (function() {
  function Cli() {
    this.anvil = {};
    this.ci = void 0;
    this.documenter = void 0;
    this.mochaRunner = void 0;
    this.socketServer = {};
    this.postProcessor = {};
    this.log = log;
    this.scheduler = new Scheduler();
    this.crawler = new FSCrawler(this.scheduler);
    this.fp = new FSProvider(this.crawler, this.log);
    this.configuration = new Configuration(this.fp, this.scheduler, this.log);
    this.compiler = new Compiler(this.fp, this.log);
    _.bindAll(this);
  }
  Cli.prototype.initCI = function(config) {
    return this.ci = new Continuous(this.fp, config, this.onFileChange);
  };
  Cli.prototype.initHost = function(config) {
    this.server = new Host(this.fp, this.scheduler, this.compiler, config);
    this.socketServer = new SocketServer(this.server.app);
    return this.log.onStep("Static HTTP server listening on port " + config.port);
  };
  Cli.prototype.initMocha = function(config) {
    return this.mochaRunner = new MochaRunner(this.fp, this.scheduler, config, this.onTestsComplete);
  };
  Cli.prototype.notifyHttpClients = function() {
    if (this.socketServer.refreshClients) {
      this.log.onStep("Notifying clients of build completion");
      return this.socketServer.refreshClients();
    }
  };
  Cli.prototype.onBuildComplete = function() {
    var self;
    self = this;
    this.log.onComplete("Build " + (this.anvil.buildNumber++) + " completed");
    if (self.mochaRunner) {
      self.log.onStep("Running specifications with Mocha");
      return self.mochaRunner.run();
    } else {
      self.startCI();
      return self.notifyHttpClients();
    }
  };
  Cli.prototype.onConfig = function(config, stop) {
    this.config = config;
    if (stop) {
      process.exit(0);
    }
    if (config.continuous) {
      this.initCI(config);
    }
    if (config.mocha) {
      this.initMocha(config);
    }
    if (config.host) {
      this.initHost(config);
    }
    this.postProcessor = new PostProcessor(config, this.fp, this.scheduler, this.log);
    this.documenter = new Documenter(config, this.fp, this.scheduler, this.log);
    this.anvil = new Anvil(this.fp, this.compiler, Combiner, this.documenter, this.scheduler, this.postProcessor, this.log, this.onBuildComplete);
    this.anvil.build(config);
    return this.startCI();
  };
  Cli.prototype.onFileChange = function() {
    this.log.onEvent("File change detected, starting build");
    this.fileChange = function() {};
    return this.anvil.build(this.config);
  };
  Cli.prototype.onTestsComplete = function() {
    this.log.onComplete("Tests completed");
    this.startCI();
    return this.notifyHttpClients();
  };
  Cli.prototype.run = function() {
    return this.configuration.configure(process.argv, this.onConfig);
  };
  Cli.prototype.startCI = function() {
    if (this.ci) {
      this.log.onStep("Starting file watchers");
      return this.ci.setup();
    }
  };
  return Cli;
})();
exports.run = function() {
  var cli;
  cli = new Cli();
  return cli.run();
};