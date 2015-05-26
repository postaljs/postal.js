var createPartialWrapper = require( "lodash/internal/createPartialWrapper" );

var _ = {
	after: require( "lodash/function/after" ),
	any: require( "lodash/internal/arraySome" ),
	bind: function( func, thisArg, arg ) {
		return createPartialWrapper( func, 33, thisArg, [ arg ] );
	},
	debounce: require( "lodash/function/debounce" ),
	each: require( "lodash/internal/createForEach" )(
		require( "lodash/internal/arrayEach" ),
		require( "lodash/internal/baseEach" )
	),
	extend: require( "lodash/internal/baseAssign" ),
	filter: require( "lodash/internal/arrayFilter" ),
	isEqual: require( "lodash/lang/isEqual" ),
	keys: require( "lodash/object/keys" ),
	map: require( "lodash/internal/arrayMap" ),
	throttle: require( "lodash/function/throttle" )
};
