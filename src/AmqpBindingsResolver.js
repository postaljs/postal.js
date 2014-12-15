/*jshint -W098 */
var bindingsResolver = {
	cache : {},
	regex : {},

	compare : function compare( binding, topic ) {
		var pattern;
		var rgx;
		var prevSegment;
		var result = ( this.cache[ topic + "-" + binding ] );
		// result is cached?
		if ( result === true ) {
			return result;
		}
		// plain string matching?
		if( binding.indexOf("#") === -1 && binding.indexOf("*") === -1) {
			result = this.cache[ topic + "-" + binding ] = (topic === binding);
			return result;
		}
		// ah, regex matching, then
		if ( !( rgx = this.regex[ binding ] )) {
			pattern = "^" + binding.split( "." ).map(function mapTopicBinding( segment ) {
				var res = "";
				if ( !!prevSegment ) {
					res = prevSegment !== "#" ? "\\.\\b" : "\\b";
				}
				if ( segment === "#" ) {
					res += "[\\s\\S]*";
				} else if ( segment === "*" ) {
					res += "[^.]+";
				} else {
					res += segment;
				}
				prevSegment = segment;
				return res;
			} ).join( "" ) + "$";
			rgx = this.regex[ binding ] = new RegExp( pattern );
		}
		result = this.cache[ topic + "-" + binding ] = rgx.test( topic );
		return result;
	},

	reset : function reset() {
		this.cache = {};
		this.regex = {};
	}
};
