var bindingsResolver = {
	cache : {},
	regex : {},

	compare : function ( binding, topic ) {
		var pattern, rgx, prev, result = (this.cache[topic] && this.cache[topic][binding]);
		if(typeof result !== "undefined") {
			return result;
		}
		if(!(rgx = this.regex[binding])) {
			pattern = "^" + _.map(binding.split('.'), function(segment) {
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
			rgx = this.regex[binding] = new RegExp( pattern );
		}
		this.cache[topic] = this.cache[topic] || {};
		this.cache[topic][binding] = result = rgx.test( topic );
		return result;
	},

	reset : function () {
		this.cache = {};
		this.regex = {};
	}
};