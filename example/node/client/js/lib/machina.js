/*
 machina.js
 Author: Jim Cowart
 License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
 Version 0.1.0
 */

(function ( root, doc, factory ) {
	if ( typeof define === "function" && define.amd ) {
		// AMD. Register as an anonymous module.
		define( ["underscore"], function ( _ ) {
			return factory( _, root, doc );
		} );
	} else {
		// Browser globals
		factory( root._, root, doc );
	}
}( this, document, function ( _, global, document, undefined ) {

	var slice = [].slice,
		NEXT_TRANSITION = "transition",
		NEXT_HANDLER = "handler",
		transformEventListToObject = function ( eventList ) {
			var obj = {};
			_.each( eventList, function ( evntName ) {
				obj[evntName] = [];
			} );
			return obj;
		},
		parseEventListeners = function ( evnts ) {
			var obj = evnts;
			if ( _.isArray( evnts ) ) {
				obj = transformEventListToObject( evnts );
			}
			return obj;
		};
	var utils = {
		makeFsmNamespace : (function () {
			var machinaCount = 0;
			return function () {
				return "fsm." + machinaCount++;
			};
		})(),
		getDefaultOptions : function () {
			return {
				initialState : "uninitialized",
				eventListeners : {
					"*" : []
				},
				states : {},
				eventQueue : [],
				namespace : utils.makeFsmNamespace()
			};
		}
	};
	var Fsm = function ( options ) {
		var opt, initialState, defaults = utils.getDefaultOptions();
		if ( options ) {
			if ( options.eventListeners ) {
				options.eventListeners = parseEventListeners( options.eventListeners );
			}
			if ( options.messaging ) {
				options.messaging = _.extend( {}, defaults.messaging, options.messaging );
			}
		}
		opt = _.extend( defaults, options || {} );
		initialState = opt.initialState;
		delete opt.initialState;
		_.extend( this, opt );

		this.state = undefined;
		this._priorAction = "";
		this._currentAction = "";
		if ( initialState ) {
			this.transition( initialState );
		}
		machina.fireEvent( "newFsm", this );
	};

	Fsm.prototype.fireEvent = function ( eventName ) {
		var args = arguments;
		_.each( this.eventListeners["*"], function ( callback ) {
			try {
				callback.apply( this, slice.call( args, 0 ) );
			} catch ( exception ) {
				if ( console && typeof console.log !== "undefined" ) {
					console.log( exception.toString() );
				}
			}
		} );
		if ( this.eventListeners[eventName] ) {
			_.each( this.eventListeners[eventName], function ( callback ) {
				try {
					callback.apply( this, slice.call( args, 1 ) );
				} catch ( exception ) {
					if ( console && typeof console.log !== "undefined" ) {
						console.log( exception.toString() );
					}
				}
			} );
		}
	};

	Fsm.prototype.handle = function ( msgType ) {
		// vars to avoid a "this." fest
		var states = this.states, current = this.state, args = slice.call( arguments, 0 ), handlerName;
		this.currentActionArgs = args;
		if ( states[current] && (states[current][msgType] || states[current]["*"]) ) {
			handlerName = states[current][msgType] ? msgType : "*";
			this._currentAction = current + "." + handlerName;
			this.fireEvent.apply( this, ["Handling"].concat( args ) );
			states[current][handlerName].apply( this, args.slice( 1 ) );
			this.fireEvent.apply( this, ["Handled"].concat( args ) );
			this._priorAction = this._currentAction;
			this._currentAction = "";
			this.processQueue( NEXT_HANDLER );
		}
		else {
			this.fireEvent.apply( this, ["NoHandler"].concat( args ) );
		}
		this.currentActionArgs = undefined;
	};

	Fsm.prototype.transition = function ( newState ) {
		if ( this.states[newState] ) {
			var oldState = this.state;
			this.state = newState;
			if ( this.states[newState]._onEnter ) {
				this.states[newState]._onEnter.call( this );
			}
			this.fireEvent.apply( this, ["Transitioned", oldState, this.state ] );
			this.processQueue( NEXT_TRANSITION );
			return;
		}
		this.fireEvent.apply( this, ["InvalidState", this.state, newState ] );
	};

	Fsm.prototype.processQueue = function ( type ) {
		var filterFn = type === NEXT_TRANSITION ?
		               function ( item ) {
			               return item.type === NEXT_TRANSITION && ((!item.untilState) || (item.untilState === this.state));
		               } :
		               function ( item ) {
			               return item.type === NEXT_HANDLER;
		               },
			toProcess = _.filter( this.eventQueue, filterFn, this );
		this.eventQueue = _.difference( this.eventQueue, toProcess );
		_.each( toProcess, function ( item, index ) {
			this.handle.apply( this, item.args );
		}, this );
	};

	Fsm.prototype.deferUntilTransition = function ( stateName ) {
		if ( this.currentActionArgs ) {
			var queued = { type : NEXT_TRANSITION, untilState : stateName, args : this.currentActionArgs };
			this.eventQueue.push( queued );
			this.fireEvent.apply( this, [ "Deferred", this.state, queued ] );
		}
	};

	Fsm.prototype.deferUntilNextHandler = function () {
		if ( this.currentActionArgs ) {
			var queued = { type : NEXT_TRANSITION, args : this.currentActionArgs };
			this.eventQueue.push( queued );
			this.fireEvent.apply( this, [ "Deferred", this.state, queued ] );
		}
	};

	Fsm.prototype.on = function ( eventName, callback ) {
		if ( !this.eventListeners[eventName] ) {
			this.eventListeners[eventName] = [];
		}
		this.eventListeners[eventName].push( callback );
	};

	Fsm.prototype.off = function ( eventName, callback ) {
		if ( this.eventListeners[eventName] ) {
			this.eventListeners[eventName] = _.without( this.eventListeners[eventName], callback );
		}
	};

	var machina = {
		Fsm : Fsm,
		bus : undefined,
		utils : utils,
		on : function ( eventName, callback ) {
			if ( !this.eventListeners[eventName] ) {
				this.eventListeners[eventName] = [];
			}
			this.eventListeners[eventName].push( callback );
		},
		off : function ( eventName, callback ) {
			if ( this.eventListeners[eventName] ) {
				this.eventListeners[eventName] = _.without( this.eventListeners[eventName], callback );
			}
		},
		fireEvent : function ( eventName ) {
			var i = 0, len, args = arguments, listeners = this.eventListeners[eventName];
			if ( listeners && listeners.length ) {
				_.each( listeners, function ( callback ) {
					callback.apply( null, slice.call( args, 1 ) );
				} );
			}
		},
		eventListeners : {
			newFsm : []
		}
	};

	global.machina = machina;
	return machina;
} ));