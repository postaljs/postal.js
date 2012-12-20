var bindingsResolver = {
	cache : { },

	compare : function ( binding, topic ) {
		if ( this.cache[topic] && this.cache[topic][binding] ) {
			return true;
		}
		var pattern = ("^" + binding.replace( /\./g, "\\." )            // escape actual periods
			                        .replace( /\*/g, "[A-Z,a-z,0-9]*" ) // asterisks match any alpha-numeric 'word'
			                        .replace( /#/g, ".*" ) + "$")       // hash matches 'n' # of words (+ optional on start/end of topic)
			                        .replace( "\\..*$", "(\\..*)*$" )   // fix end of topic matching on hash wildcards
			                        .replace( "^.*\\.", "^(.*\\.)*" );  // fix beginning of topic matching on hash wildcards
		var rgx = new RegExp( pattern );
		var result = rgx.test( topic );
		if ( result ) {
			if ( !this.cache[topic] ) {
				this.cache[topic] = {};
			}
			this.cache[topic][binding] = true;
		}
		return result;
	},

	reset : function () {
		this.cache = {};
	}
};