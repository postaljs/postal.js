/*jshint -W098 */
var ConsecutiveDistinctPredicate = function () {
	var previous;
	return function ( data ) {
		var eq = false;
		if ( typeof data === 'string' ) {
			eq = data === previous;
			previous = data;
		}
		else {
			eq = _.isEqual( data, previous );
			previous = _.clone( data );
		}
		return !eq;
	};
};