/*jshint -W098 */
var DistinctPredicate = function () {
	var previous = [];

	return function ( data ) {
		var isDistinct = true;
		for ( var p in previous ) {
			if ( typeof data === 'object' ) {
				if ( _.isEqual( data, previous[ p ] ) ) {
					isDistinct = false;
					break;
				}
			} else if ( data === previous[ p ] ) {
				isDistinct = false;
				break;
			}
		}
		if ( isDistinct ) {
			previous.push( data );
		}
		return isDistinct;
	};
};