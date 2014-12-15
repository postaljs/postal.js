/*jshint -W098 */
(function( root, factory ) {
	/* istanbul ignore if  */
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( [ "lodash" ], function( _ ) {
			return factory( _, root );
		} );
	/* istanbul ignore else */
	} else if ( typeof module === "object" && module.exports ) {
		var _ = {
			after: require( "lodash.after" ),
			any: require( "lodash.some" ),
			clone: require( "lodash.clone" ),
			debounce: require( "lodash.debounce" ),
			isArray: require( "lodash.isarray" ),
			isEmpty: require( "lodash.isempty" ),
			isEqual: require( "lodash.isequal" ),
			isFunction: require( "lodash.isfunction" ),
			isNumber: require( "lodash.isnumber" ),
			isObject: require( "lodash.isobject" ),
			isString: require( "lodash.isstring" ),
			throttle: require( "lodash.throttle" ),
		};
		// Node, or CommonJS-Like environments
		module.exports = factory( _, this );
	} else {
		// Browser globals
		root.postal = factory( root._, root );
	}
}( this, function( _, global, undefined ) {

	var _postal;
	var prevPostal = global.postal;

	//import("ChannelDefinition.js");
	//import("SubscriptionDefinition.js");
	//import("AmqpBindingsResolver.js");
	//import("Api.js");

	/*jshint -W106 */
	if ( global && Object.prototype.hasOwnProperty.call( global, "__postalReady__" ) && _.isArray( global.__postalReady__ ) ) {
		while (global.__postalReady__.length) {
			global.__postalReady__.shift().onReady( _postal );
		}
	}
	/*jshint +W106 */

	return _postal;
} ));
