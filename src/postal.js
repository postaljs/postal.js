/*jshint -W098 */
(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = function ( ) {
			return factory();
		};
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( function () {
			return factory( root );
		} );
	} else {
		// Browser globals
		root.postal = factory( root );
	}
}( this, function ( global, undefined ) {

	var postal;

	//import("Shim.js");
	//import("Util.js");
	//import("ConsecutiveDistinctPredicate.js");
	//import("DistinctPredicate.js");
	//import("ChannelDefinition.js");
	//import("SubscriptionDefinition.js");
	//import("AmqpBindingsResolver.js");
	//import("LocalBus.js");
	//import("Api.js");

	/*jshint -W106 */
	if ( global && _.has( global, "__postalReady__" ) && Array.isArray( global.__postalReady__ ) ) {
		while(global.__postalReady__.length) {
			global.__postalReady__.shift().onReady(postal);
		}
	}
	/*jshint +W106 */

	return postal;
} ));