var bindingsResolver = {
	cache : { },

	compare : function ( binding, topic ) {
		var result = (this.cache[topic] && this.cache[topic][binding]);
		if(typeof result !== "undefined") {
			return result;
		}
		var prev;
		var pattern = "^" + _.map(binding.split('.'), function(segment) {
			var res = !!prev && prev !== "#" ? "\\.\\b" : "\\b";
			if(segment === "#") {
				res += "[A-Z,a-z,0-9,\\.]*"
			} else if (segment === "*") {
				res += "[A-Z,a-z,0-9]+"
			} else {
				res += segment;
			}
			prev = segment;
			return res;
		} ).join('') + "$";
		var rgx = new RegExp( pattern );
		this.cache[topic] = this.cache[topic] || {};
		this.cache[topic][binding] = result = rgx.test( topic );
		return result;
	},

	reset : function () {
		this.cache = {};
	}
};