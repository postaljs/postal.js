/*jshint -W098 */
(function( root, factory ) {
	/* istanbul ignore if  */
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define(function() {
			return factory( root );
		} );
	/* istanbul ignore else */
	} else if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = factory( this );
	} else {
		// Browser globals
		root.postal = factory( root );
	}
}( this, function( global, undefined ) {

	var _postal;
	var prevPostal = global.postal;

	//import("ChannelDefinition.js");
	//import("SubscriptionDefinition.js");
	//import("AmqpBindingsResolver.js");
	//import("Api.js");

	/*jshint -W106 */
	if ( global && Object.prototype.hasOwnProperty.call( global, "__postalReady__" ) && Array.isArray( global.__postalReady__ ) ) {
		while (global.__postalReady__.length) {
			global.__postalReady__.shift().onReady( _postal );
		}
	}
	/*jshint +W106 */

	return _postal;
} ));
