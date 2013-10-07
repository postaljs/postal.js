var _ = {};

_.isNaN = function ( value ) {
	return (typeof value == 'number' || Object.prototype.toString.call( value ) == Number) && value != +value;
};

_.isEqual = function ( a, b ) {
	return JSON.stringify( a ) === JSON.stringify( b )
};

// Source: https://github.com/jashkenas/underscore/blob/1.5.2/underscore.js#L818

_.extend = function ( obj ) {
	Array.prototype.slice.call( arguments, 1 ).forEach( function ( source ) {
		if ( source ) {
			for ( var prop in source ) {
				obj[prop] = source[prop];
			}
		}
	} );
	return obj;
};

// Source: https://github.com/jashkenas/underscore/blob/1.5.2/underscore.js#L862

_.clone = function ( obj ) {
	if ( typeof obj !== 'object' ) return obj;
	return Array.isArray( obj ) ? obj.slice() : _.extend( {}, obj );
};

// Source: https://github.com/jashkenas/underscore/blob/1.5.2/underscore.js#L1045

_.has = function ( obj, key ) {
	return Object.prototype.hasOwnProperty.call( obj, key );
};

// Source: https://github.com/jashkenas/underscore/blob/1.5.2/underscore.js#L973

_.isEmpty = function ( obj ) {
	if ( obj == null ) return true;
	if ( Array.isArray( obj ) || typeof obj === 'string' ) return obj.length === 0;
	for ( var key in obj ) if ( _.has( obj, key ) ) return false;
	return true;
};

// Source: https://github.com/lodash/lodash/blob/2.2.1/lodash.js#L3185

_.all = function ( collection, callback ) {
	var result = true, index = -1, length = collection.length;
	while ( ++index < length ) {
		if ( !(result = !!callback( collection[index], index, collection )) ) {
			break;
		}
	}
	return result;
};

_.getTime = (Date.now || function () {
	return new Date().getTime();
});

_.debounceOptions = {
	'leading' : false,
	'maxWait' : 0,
	'trailing' : false
};

// Source: https://github.com/jashkenas/underscore/blob/1.5.2/underscore.js#L693

_.debounce = function ( func, wait, immediate ) {
	var timeout, args, context, timestamp, result;
	return function () {
		context = this;
		args = arguments;
		timestamp = new Date();
		var later = function () {
			var last = (new Date()) - timestamp;
			if ( last < wait ) {
				timeout = setTimeout( later, wait - last );
			} else {
				timeout = null;
				if ( !immediate ) result = func.apply( context, args );
			}
		};
		var callNow = immediate && !timeout;
		if ( !timeout ) {
			timeout = setTimeout( later, wait );
		}
		if ( callNow ) result = func.apply( context, args );
		return result;
	};
};

// Source: https://github.com/lodash/lodash/blob/2.2.1/lodash.js#L5789

_.throttle = function ( func, wait, options ) {
	var leading = true,
			trailing = true;

	if ( options === false ) {
		leading = false;
	} else if ( typeof options === 'object' ) {
		leading = 'leading' in options ? options.leading : leading;
		trailing = 'trailing' in options ? options.trailing : trailing;
	}
	_.debounceOptions.leading = leading;
	_.debounceOptions.maxWait = wait;
	_.debounceOptions.trailing = trailing;

	var result = _.debounce( func, wait, _.debounceOptions );
	return result;
};

// Source: https://github.com/lodash/lodash/blob/2.2.1/lodash.js#L5170

_.after = function ( n, func ) {
	return function () {
		if ( --n < 1 ) {
			return func.apply( this, arguments );
		}
	};
};
