/* global _postal */
/*jshint -W117 */
var SubscriptionDefinition = function(channel, topic, callback) {
    if (arguments.length !== 3) {
        throw new Error("You must provide a channel, topic and callback when creating a SubscriptionDefinition instance.");
    }
    if (topic.length === 0) {
        throw new Error("Topics cannot be empty");
    }
    this.channel = channel;
    this.topic = topic;
    this.subscribe(callback);
};

var ConsecutiveDistinctPredicate = function() {
    var previous;
    return function(data) {
        var eq = false;
        if (_.isString(data)) {
            eq = data === previous;
            previous = data;
        } else {
            eq = _.isEqual(data, previous);
            previous = _.clone(data);
        }
        return !eq;
    };
};

var DistinctPredicate = function() {
    var previous = [];
    return function(data) {
        var isDistinct = !_.any(previous, function(p) {
            if (_.isObject(data) || _.isArray(data)) {
                return _.isEqual(data, p);
            }
            return data === p;
        });
        if (isDistinct) {
            previous.push(data);
        }
        return isDistinct;
    };
};

var strats = {
    withDelay: function(ms) {
        if (_.isNaN(ms)) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "withDelay",
            fn: function(next, data, envelope) {
                setTimeout(function() {
                    next(data, envelope);
                }, ms);
            }
        };
    },
    defer: function() {
        return this.withDelay(0);
    },
    stopAfter: function(maxCalls, callback) {
        if (_.isNaN(maxCalls) || maxCalls <= 0) {
            throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
        }
        var dispose = _.after(maxCalls, callback);
        return {
            name: "stopAfter",
            fn: function(next, data, envelope) {
                dispose();
                next(data, envelope);
            }
        };
    },
    withThrottle: function(ms) {
        if (_.isNaN(ms)) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "withThrottle",
            fn: _.throttle(function(next, data, envelope) {
                next(data, envelope);
            }, ms)
        };
    },
    withDebounce: function(ms, immediate) {
        if (_.isNaN(ms)) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "debounce",
            fn: _.debounce(function(next, data, envelope) {
                next(data, envelope);
            }, ms, !! immediate)
        };
    },
    withConstraint: function(pred) {
        if (!_.isFunction(pred)) {
            throw "Predicate constraint must be a function";
        }
        return {
            name: "withConstraint",
            fn: function(next, data, envelope) {
                if (pred.call(this, data, envelope)) {
                    next.call(this, data, envelope);
                }
            }
        };
    },
    distinct: function(options) {
        options = options || {};
        var accessor = function(args) {
            return args[0];
        };
        var check = options.all ?
            new DistinctPredicate(accessor) :
            new ConsecutiveDistinctPredicate(accessor);
        return {
            name: "distinct",
            fn: function(next, data, envelope) {
                if (check(data)) {
                    next(data, envelope);
                }
            }
        };
    }
};

SubscriptionDefinition.prototype = {

    after: function() {
        this.callback.after.apply(this, arguments);
        return this;
    },

    before: function() {
        this.callback.before.apply(this, arguments);
        return this;
    },

    "catch": function(errorHandler) {
        var original = this.callback.target();
        var safeTarget = function() {
            try {
                original.apply(this, arguments);
            } catch (err) {
                errorHandler(err, arguments[0]);
            }
        };
        this.callback.target(safeTarget);
        return this;
    },

    defer: function() {
        this.callback.before(strats.defer());
        return this;
    },

    disposeAfter: function(maxCalls) {
        var self = this;
        self.callback.before(strats.stopAfter(maxCalls, function() {
            self.unsubscribe.call(self);
        }));
        return self;
    },

    distinctUntilChanged: function() {
        this.callback.before(strats.distinct());
        return this;
    },

    distinct: function() {
        this.callback.before(strats.distinct({
            all: true
        }));
        return this;
    },

    logError: function() {
        if (console) {
            var report;
            if (console.warn) {
                report = console.warn;
            } else {
                report = console.log;
            }
            this["catch"](report);
        }
        return this;
    },

    once: function() {
        this.disposeAfter(1);
        return this;
    },

    subscribe: function(callback) {
        this.callback = new Conduit.Async({
            target: callback,
            context: this
        });
        return this;
    },

    unsubscribe: function() {
        if (!this.inactive) {
            this.inactive = true;
            _postal.unsubscribe(this);
        }
    },

    withConstraint: function(predicate) {
        this.callback.before(strats.withConstraint(predicate));
        return this;
    },

    withConstraints: function(preds) {
        while (preds.length) {
            this.callback.before(strats.withConstraint(preds.shift()));
        }
        return this;
    },

    withDebounce: function(milliseconds, immediate) {
        this.callback.before(strats.withDebounce(milliseconds, immediate));
        return this;
    },

    withDelay: function(milliseconds) {
        this.callback.before(strats.withDelay(milliseconds));
        return this;
    },

    withThrottle: function(milliseconds) {
        this.callback.before(strats.withThrottle(milliseconds));
        return this;
    },

    withContext: function(context) {
        this.callback.context(context);
        return this;
    }
};
