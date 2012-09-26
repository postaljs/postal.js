(function ( root, doc, factory ) {
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["postal"], function ( postal ) {
			return factory( postal, root, doc );
		} );
	} else {
		// Browser globals
		factory( root.postal, root, doc );
	}
}( this, document, function ( postal, global, document, undefined ) {

	//import("../BindingsResolver.js");
	postal.configuration.resolver = classicBindingsResolver;

} ));