// Setup for running Mocha via Node
require( "should/should" );
require( "traceur" );

global._ = require( "lodash" );

global.postal = require( "../../lib/postal.js" );
