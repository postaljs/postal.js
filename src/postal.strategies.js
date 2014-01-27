/*jshint -W098 */
(function ( root, factory ) {
	if ( typeof module === "object" && module.exports ) {
		// Node, or CommonJS-Like environments
		module.exports = function(postal) {
            return factory( postal, this );
        };
	} else if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["postal"], function ( postal ) {
			return factory( postal, root );
		} );
	} else {
		// Browser globals
		root.postal = factory( root.postal, root );
	}
}( this, function ( postal, global, undefined ) {

    (function(SubscriptionDefinition) {
        //import("strategies.js");
    }(postal.SubscriptionDefinition));

	return postal;
} ));