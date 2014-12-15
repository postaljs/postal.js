/* global _postal */
var SubscriptionDefinition = function( channel, topic, callback ) {
	if ( arguments.length !== 3 ) {
		throw new Error( "You must provide a channel, topic and callback when creating a SubscriptionDefinition instance." );
	}
	if ( topic.length === 0 ) {
		throw new Error( "Topics cannot be empty" );
	}
	this.channel = channel;
	this.topic = topic;
	this.callback = callback;
	this.pipeline = [];
	this.cacheKeys = [];
	this._context = undefined;
};

var clone = function(data) {
	var newObj = {};
	for (var i in data) {
		if (data[i] && typeof data[i] === "object") {
			newObj[i] = clone(data[i]);
		} else {
			newObj[i] = data[i];
		}
	}
	return newObj;
};

var equals = function(x, y) {
	// if both x and y are null or undefined and exactly the same
	if ( x === y ) {
		return true;
	}

	// if they are not strictly equal, they both need to be Objects
	if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) {
		return false;
	}

	// they must have the exact same prototype chain, the closest we can do is
	// test there constructor.
	if ( x.constructor !== y.constructor ) {
		return false;
	}

	for ( var p in x ) {
		// other properties were tested using x.constructor === y.constructor
		if ( ! x.hasOwnProperty( p ) ) {
			continue;
		}

		// allows to compare x[ p ] and y[ p ] when set to undefined
		if ( ! y.hasOwnProperty( p ) ) {
			return false;
		}

		// if they have the same strict value or identity then they are equal
		if ( x[ p ] === y[ p ] ) {
			continue;
		}

		// Numbers, Strings, Functions, Booleans must be strictly equal
		if ( typeof( x[ p ] ) !== "object" ) {
			return false;
		}

		// Objects and Arrays must be tested recursively
		if ( ! equals( x[ p ],  y[ p ] ) ) {
			return false;
		}
	}

	for ( p in y ) {
		// allows x[ p ] to be set to undefined
		if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) {
			return false;
		}
	}

	return true;
};

var ConsecutiveDistinctPredicate = function() {
	var previous;
	return function( data ) {
		var eq = false;
		if ( typeof data === "string" ) {
			eq = data === previous;
			previous = data;
		} else {
			eq = equals( data, previous );
			previous = clone( data );
		}
		return !eq;
	};
};

var DistinctPredicate = function DistinctPredicateFactory() {
	var previous = [];
	return function DistinctPredicate( data ) {
		var isDistinct = true;
		previous.every( function( p ) {
			var type = typeof data;
			var isObject = type === "function" || (data && type === "object") || false;
			if ( isObject || Array.isArray( data ) ) {
				if( equals( data, p ) ) {
					isDistinct = false;
					return false;
				}
			}
			if( data === p ) {
				isDistinct = false;
				return false;
			}

			return true;
		} );
		if ( isDistinct ) {
			previous.push( data );
		}
		return isDistinct;
	};
};

var debounceFn = function(func, wait, immediate) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) {
			func.apply(context, args);
		}
	};
};

var throttleFn = function(fn, threshhold, scope) {
	threshhold = threshhold || 250;
	var last, deferTimer;
	return function () {
		var context = scope || this;

		var now = +new Date(),
			args = arguments;
		if (last && now < last + threshhold) {
			// hold on to it
			clearTimeout(deferTimer);
			deferTimer = setTimeout(function () {
				last = now;
				fn.apply(context, args);
			}, threshhold);
		} else {
			last = now;
			fn.apply(context, args);
		}
	};
};

SubscriptionDefinition.prototype = {

	"catch": function( errorHandler ) {
		var original = this.callback;
		var safeCallback = function() {
			try {
				original.apply( this, arguments );
			} catch (err) {
				errorHandler( err, arguments[ 0 ] );
			}
		};
		this.callback = safeCallback;
		return this;
	},

	defer: function defer() {
		return this.delay( 0 );
	},

	disposeAfter: function disposeAfter( maxCalls ) {
		if ( typeof maxCalls !== "number" || maxCalls <= 0 ) {
			throw new Error( "The value provided to disposeAfter (maxCalls) must be a number greater than zero." );
		}
		var self = this;
		var n = maxCalls;
		var dispose = function() {
			if (--n < 1) {
				return self.unsubscribe();
	        }
		};
		self.pipeline.push( function( data, env, next ) {
			next( data, env );
			dispose();
		} );
		return self;
	},

	distinct: function distinct() {
		return this.constraint( new DistinctPredicate() );
	},

	distinctUntilChanged: function distinctUntilChanged() {
		return this.constraint( new ConsecutiveDistinctPredicate() );
	},

	invokeSubscriber: function invokeSubscriber( data, env ) {
		if ( !this.inactive ) {
			var self = this;
			var pipeline = self.pipeline;
			var len = pipeline.length;
			var context = self._context;
			var idx = -1;
			if ( !len ) {
				self.callback.call( context, data, env );
			} else {
				pipeline = pipeline.concat( [ self.callback ] );
				var step = function step( d, e ) {
					idx += 1;
					if ( idx < len ) {
						pipeline[ idx ].call( context, d, e, step );
					} else {
						self.callback.call( context, d, e );
					}
				};
				step( data, env, 0 );
			}
		}
	},

	logError: function logError() {
		/* istanbul ignore else */
		if ( console ) {
			var report;
			if ( console.warn ) {
				report = console.warn;
			} else {
				report = console.log;
			}
			this[ "catch" ]( report );
		}
		return this;
	},

	once: function once() {
		return this.disposeAfter( 1 );
	},

	subscribe: function subscribe( callback ) {
		this.callback = callback;
		return this;
	},

	unsubscribe: function unsubscribe() {
		/* istanbul ignore else */
		if ( !this.inactive ) {
			_postal.unsubscribe( this );
		}
	},

	constraint: function constraint( predicate ) {
		if ( typeof predicate !== "function" ) {
			throw new Error( "Predicate constraint must be a function" );
		}
		this.pipeline.push( function( data, env, next ) {
			if ( predicate.call( this, data, env ) ) {
				next( data, env );
			}
		} );
		return this;
	},

	constraints: function constraints( predicates ) {
		var self = this;
		/* istanbul ignore else */
		if ( Array.isArray( predicates ) ) {
			predicates.forEach( function( predicate ) {
				self.constraint( predicate );
			} );
		}
		return self;
	},

	context: function contextSetter( context ) {
		this._context = context;
		return this;
	},

	debounce: function debounce( milliseconds, immediate ) {
		if ( typeof milliseconds !== "number" ) {
			throw new Error( "Milliseconds must be a number" );
		}
		var fn = function( data, env, next ) {
			next( data, env );
		};
		this.pipeline.push(
			debounceFn( function( data, env, next ) {
				next( data, env );
			},
				milliseconds,
				!!immediate
			)
		);
		return this;
	},

	delay: function delay( milliseconds ) {
		if ( typeof milliseconds !== "number" ) {
			throw new Error( "Milliseconds must be a number" );
		}
		var self = this;
		self.pipeline.push( function( data, env, next ) {
			setTimeout( function() {
				next( data, env );
			}, milliseconds );
		} );
		return this;
	},

	throttle: function throttle( milliseconds ) {
		if ( typeof milliseconds !== "number" ) {
			throw new Error( "Milliseconds must be a number" );
		}
		var fn = function( data, env, next ) {
			next( data, env );
		};
		this.pipeline.push( throttleFn( fn, milliseconds ) );
		return this;
	}
};

// Backwards Compatibility
// WARNING: these will be removed by version 0.13
function warnOnDeprecation( oldMethod, newMethod ) {
	return function() {
		if ( console.warn || console.log ) {
			var msg = "Warning, the " + oldMethod + " method has been deprecated. Please use " + newMethod + " instead.";
			if ( console.warn ) {
				console.warn( msg );
			} else {
				console.log( msg );
			}
		}
		return SubscriptionDefinition.prototype[ newMethod ].apply( this, arguments );
	};
}
var oldMethods = [ "withConstraint", "withConstraints", "withContext", "withDebounce", "withDelay", "withThrottle" ];
var newMethods = [ "constraint", "constraints", "context", "debounce", "delay", "throttle" ];
for (var i = 0; i < 6; i++) {
	var oldMethod = oldMethods[ i ];
	SubscriptionDefinition.prototype[ oldMethod ] = warnOnDeprecation( oldMethod, newMethods[ i ] );
}
