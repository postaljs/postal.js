//import("../BindingsResolver.js");

module.exports = {
	configure: function(postal) {
		postal.configuration.resolver = classicBindingsResolver;
		return postal;
	}
};