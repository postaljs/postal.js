(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = function ( _ ) {
			_ = _ || require( "underscore" );
			return factory( _ );
		}
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["."], function ( _ ) {
			return factory( _, root );
		} );
	} else {
		// Browser globals
		root.postal = factory( root._, root );
	}
}( this, function ( _, global, undefined ) {

	//import("Constants.js");
	//import("ConsecutiveDistinctPredicate.js");
	//import("DistinctPredicate.js");
	//import("ChannelDefinition.js");
	//import("SubscriptionDefinition.js");
	//import("AmqpBindingsResolver.js");
	//import("LocalBus.js");
	//import("Api.js");

	return postal;
} ));