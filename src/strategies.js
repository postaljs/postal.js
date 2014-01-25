/* global DistinctPredicate,ConsecutiveDistinctPredicate */
var strats = {
    setTimeout: function(ms) {
        return {
            name: "setTimeout",
            fn: function (next, data, envelope) {
                setTimeout(function () {
                    next(data, envelope);
                }, ms);
            }
        };
    },
    after: function(maxCalls, callback) {
        var dispose = _.after(maxCalls, callback);
        return {
            name: "after",
            fn: function (next, data, envelope) {
                dispose();
                next(data, envelope);
            }
        };
    },
    throttle : function(ms) {
        return {
            name: "throttle",
            fn: _.throttle(function(next, data, envelope) {
                next(data, envelope);
            }, ms)
        };
    },
    debounce: function(ms, immediate) {
        return {
            name: "debounce",
            fn: _.debounce(function(next, data, envelope) {
                next(data, envelope);
            }, ms, !!immediate)
        };
    },
    predicate: function(pred) {
        return {
            name: "predicate",
            fn: function(next, data, envelope) {
                if(pred.call(this, data, envelope)) {
                    next.call(this, data, envelope);
                }
            }
        };
    },
    distinct : function(options) {
        options = options || {};
        var accessor = function(args) {
            return args[0];
        };
        var check = options.all ?
            new DistinctPredicate(accessor) :
            new ConsecutiveDistinctPredicate(accessor);
        return {
            name : "distinct",
            fn : function(next, data, envelope) {
                if(check(data)) {
                    next(data, envelope);
                }
            }
        };
    }
};