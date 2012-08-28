// # Scheduler
// Asynchronous abstractions
var schedulerFactory = function( _ ) {

	function Scheduler() {

	}

	Scheduler.prototype.parallel = function( list, task, onComplete ) {
		var length = 0,
			index = 0,
			results = [],
			callback = function( result, resultIndex ){
				results[ resultIndex ] = result;
				if( --length === 0 ) {
					onComplete( results );
				}
			},
			input,
			args;

		// if the list of inputs is empty, then return an empty list.
		if( !list || ( length = list.length ) === 0 ) {
			onComplete( [] );
		}

		_.each( list, function( input ) {
			task( input, function( result ) { callback( result, index ); } );
			index++;
		} );
	};

	Scheduler.prototype.mapped = function( map, onComplete ) {
		var keys = _.keys( map ),
			remaining = keys.length,
			results = {},
			callback = function( name, result ){
				results[ name ] = result;
				if( --remaining === 0 && firstPassComplete ) {
					onComplete( results );
				}
			},
			firstPassComplete;

		_.each( keys, function( key ) {
			map[ key ]( function( value ){ callback( key, value ); } );
		} );
		firstPassComplete = true;

		// if the remaining count is 0, we're done
		if( remaining === 0 ) {
			onComplete( results );
		}
	};

	Scheduler.prototype.pipeline = function( initial, transforms, onComplete ) {
		var current = initial,
			iterate = function iterate() {
				transforms.shift()( current, done );
			},
			done = function done( result ) {
				current = result;
				if( transforms.length === 0 ) {
					onComplete( current );
				} else {
					iterate();
				}
			};

		if( !transforms || transforms.length === 0 ) {
			onComplete( initial );
		} else {
			iterate( done );
		}
	};

	return Scheduler;
};

module.exports = schedulerFactory;