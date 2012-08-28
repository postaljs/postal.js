#!/usr/bin/env node

var Haml = require('./haml');

var readUntilEnd = function(stream, callback) {
    var chunks = [];
    stream.on('data', function(chunk) {
        chunks.push(chunk.toString('utf-8'));
    });
    stream.on('end', function() {
        callback(chunks.join(''));
    });
}

readUntilEnd(process.openStdin(), function(haml) {
    var result;
    
    if (haml.length == 0) {
        console.log("Error: HAML expected on stdin")
        process.exit(1);
    }
    
    // --html
    if ((process.argv.length >= 3) && (process.argv[2] == '--html')) {
        result = Haml.render(haml);
    }
    
    // --js
    else {
        result = Haml.optimize(
                    Haml.compile(
                        haml));
    }
    
    process.stdout.write(result);
});
