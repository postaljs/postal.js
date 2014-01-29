var Conduit = function( options ) {
    if ( typeof options.target !== "function" ) {
        throw new Error( "You can only make functions into Conduits." );
    }
    var _steps = {
        pre : options.pre  || [],
        post: options.post || [],
        all : []
    };
    var _defaultContext = options.context;
    var _targetStep = {
        isTarget: true,
        fn: function(next) {
            var args = Array.prototype.slice.call( arguments, 1 );
            options.target.apply( _defaultContext, args);
            next.apply(this, args);
        }
    };
    var _genPipeline = function() {
        _steps.all = _steps.pre.concat([_targetStep].concat(_steps.post));
    };
    _genPipeline();
    var conduit = function() {
        var idx = 0;
        var next = function next() {
            var args = Array.prototype.slice.call( arguments, 0 );
            var thisIdx = idx;
            var step;
            idx += 1;
            if (thisIdx < _steps.all.length ) {
                step = _steps.all[thisIdx];
                step.fn.apply( step.context || _defaultContext, [next].concat( args ) );
            }
        };
        next.apply( this, arguments );
    };
    conduit.steps = function() {
        return _steps.all;
    };
    conduit.context = function( ctx ) {
        if ( arguments.length === 0 ) {
            return _defaultContext;
        } else {
            _defaultContext = ctx;
        }
    };
    conduit.before = function(step, options) {
        step =  typeof step === "function" ? { fn: step } : step;
        options = options || {};
        if(options.prepend) {
            _steps.pre.unshift( step );
        } else {
            _steps.pre.push( step );
        }
        _genPipeline();
    };
    conduit.after = function(step, options) {
        step =  typeof step === "function" ? { fn: step } : step;
        options = options || {};
        if(options.prepend) {
            _steps.post.unshift( step );
        } else {
            _steps.post.push( step );
        }
        _genPipeline();
    };
    conduit.clear = function() {
        _steps = {
            pre : [],
            post: [],
            all : []
        };
    };
    return conduit;
};