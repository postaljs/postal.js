# Node's event emitter for all engines.
events = require("events")
emitter = events.EventEmitter

# JavaScript's functional programming helper library -- 
# See http://documentcloud.github.com/underscore for more info
_ = require "underscore"

# Console colors for Node -- 
# See https://github.com/Marak/colors.js for more info
colors = require "colors"

# Filesystem API
fs = require "fs"

# Recursive mkdir for Node (think _mkdir -p_) -- 
# See ://github.com/substack/node-mkdirp for more info
mkdir = require( "mkdirp" ).mkdirp

# Node's path helper library
path = require "path"

# A Sinatra inspired web development framework for Node -- 
# See http://expressjs.com for more info
express = require "express"