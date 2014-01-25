var Strategy = function( options ) {
    var _target = options.owner[options.prop];
    if ( typeof _target !== "function" ) {
        throw new Error( "Strategies can only target methods." );
    }
    var _strategies = [];
    var _context = options.context || options.owner;
    var strategy = function() {
        var idx = 0;
        var next = function next() {
            var args = Array.prototype.slice.call( arguments, 0 );
            var thisIdx = idx;
            var strategy;
            idx += 1;
            if ( thisIdx < _strategies.length ) {
                strategy = _strategies[thisIdx];
                strategy.fn.apply( strategy.context || _context, [next].concat( args ) );
            } else {
                _target.apply( _context, args );
            }
        };
        next.apply( this, arguments );
    };
    strategy.target = function() {
        return _target;
    };
    strategy.context = function( ctx ) {
        if ( arguments.length === 0 ) {
            return _context;
        } else {
            _context = ctx;
        }
    };
    strategy.strategies = function() {
        return _strategies;
    };
    strategy.useStrategy = function( strategy ) {
        var idx = 0,
            exists = false;
        while ( idx < _strategies.length ) {
            if ( _strategies[idx].name === strategy.name ) {
                _strategies[idx] = strategy;
                exists = true;
                break;
            }
            idx += 1;
        }
        if ( !exists ) {
            _strategies.push( strategy );
        }
    };
    strategy.reset = function() {
        _strategies = [];
    };
    if ( options.lazyInit ) {
        _target.useStrategy = function() {
            options.owner[options.prop] = strategy;
            strategy.useStrategy.apply( strategy, arguments );
        };
        _target.context = function() {
            options.owner[options.prop] = strategy;
            return strategy.context.apply( strategy, arguments );
        };
        return _target;
    } else {
        return strategy;
    }
};