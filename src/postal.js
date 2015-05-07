/*jshint -W098 */
( function( root, factory ) {
	/* istanbul ignore if  */
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( [ "lodash" ], function( _ ) {
			return factory( _, root );
		} );
	/* istanbul ignore else */
	} else if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = factory( require( "lodash" ), this );
	} else {
		// Browser globals
		root.postal = factory( root._, root );
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
