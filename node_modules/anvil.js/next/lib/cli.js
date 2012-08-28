// # Cli
// Provides the command line interface for interacting with Anvil and related modules
var cliFactory = function( _, Anvil, Configuration ) {

	// ## constructor
	// Create the initial instance where all we really have is the
	// configuration module to get us started.
	var Cli = function() {
		this.configuration = new Configuration();
		_.bindAll( this );
	};

	// ## start
	// Kicks off the configuration process
	Cli.prototype.start = function() {
		this.configuration( process.argv, function( config, done ) {
			if( !done ) {
				Anvil.configure( config );
			}
		} );
	};

	return Cli;
};
module.exports = cliFactory;