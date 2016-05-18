/*jshint -W098 */
/* global _ */
( function( root, factory ) {
	//import("mindash.js");

	/* istanbul ignore if  */
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( function() {
			return factory( _, root );
		} );
	/* istanbul ignore else */
	} else if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = factory( _, this );
	} else {
		// Browser globals
		root.postal = factory( _, root );
	}
}( this, function( _, global, undefined ) {
	var prevPostal = global.postal;
	var _defaultConfig = {
		DEFAULT_CHANNEL: "/",
		SYSTEM_CHANNEL: "postal",
		enableSystemMessages: true,
		cacheKeyDelimiter: "|",
		autoCompactResolver: false
	};
	var postal = {
		configuration: _.extend( {}, _defaultConfig )
	};
	var _config = postal.configuration;

	//import("ChannelDefinition.js");
	//import("SubscriptionDefinition.js");
	//import("AmqpBindingsResolver.js");
	//import("Api.js");

	/*jshint -W106 */
	if ( global && Object.prototype.hasOwnProperty.call( global, "__postalReady__" ) && _.isArray( global.__postalReady__ ) ) {
		while ( global.__postalReady__.length ) {
			global.__postalReady__.shift().onReady( postal );
		}
	}
	/*jshint +W106 */

	return postal;
} ) );
