(function ( root, factory ) {
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["underscore"], function ( _ ) {
			return factory( _, root );
		} );
	} else {
		// Browser globals
		factory( root._, root );
	}
}( this, function ( _, global, undefined ) {

	//import("../Constants.js");
	//import("../ConsecutiveDistinctPredicate.js");
	//import("../DistinctPredicate.js");
	//import("../ChannelDefinition.js");
	//import("../SubscriptionDefinition.js");
	//import("../AmqpBindingsResolver.js");
	//import("../LocalBus.js");
	//import("../Api.js");

	global.postal = postal;
	return postal;
} ));