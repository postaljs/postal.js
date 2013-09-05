/*jshint -W098 */
var bindingsResolver = {
	cache : {},
	regex : {},

	compare : function ( binding, topic ) {
		var pattern, rgx, prevSegment, result = ( this.cache[ topic ] && this.cache[ topic ][ binding ] );
		if ( typeof result !== "undefined" ) {
			return result;
		}
		if ( !( rgx = this.regex[ binding ] )) {
			pattern = "^" + _.map( binding.split( "." ),function ( segment ) {
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
		this.cache[ topic ] = this.cache[ topic ] || {};
		this.cache[ topic ][ binding ] = result = rgx.test( topic );
		return result;
	},

	reset : function () {
		this.cache = {};
		this.regex = {};
	}
};