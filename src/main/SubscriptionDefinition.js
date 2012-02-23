var SubscriptionDefinition = function(exchange, topic, callback) {
    this.exchange = exchange;
    this.topic = topic;
    this.callback = callback;
    this.priority = DEFAULT_PRIORITY;
    this.constraints = [];
    this.maxCalls = DEFAULT_DISPOSEAFTER;
    this.onHandled = NO_OP;
    this.context = null;

    postal.publish(SYSTEM_EXCHANGE, "subscription.created",
        {
            event: "subscription.created",
            exchange: exchange,
            topic: topic
        });
};

SubscriptionDefinition.prototype = {
    unsubscribe: function() {
        postal.configuration.bus.unsubscribe(this);
        postal.publish(SYSTEM_EXCHANGE, "subscription.removed",
            {
                event: "subscription.removed",
                exchange: this.exchange,
                topic: this.topic
            });
    },

    defer: function() {
        var fn = this.callback;
        this.callback = function(data) {
            setTimeout(fn,0,data);
        };
        return this;
    },

    disposeAfter: function(maxCalls) {
        if(_.isNaN(maxCalls) || maxCalls <= 0) {
            throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
        }

        var fn = this.onHandled;
        var dispose = _.after(maxCalls, _.bind(function() {
                this.unsubscribe(this);
            }, this));

        this.onHandled = function() {
            fn.apply(this.context, arguments);
            dispose();
        };
        return this;
    },

    ignoreDuplicates: function() {
        this.withConstraint(new DistinctPredicate());
        return this;
    },

    whenHandledThenExecute: function(callback) {
        if(! _.isFunction(callback)) {
            throw "Value provided to 'whenHandledThenExecute' must be a function";
        }
        this.onHandled = callback;
        return this;
    },

    withConstraint: function(predicate) {
        if(! _.isFunction(predicate)) {
            throw "Predicate constraint must be a function";
        }
        this.constraints.push(predicate);
        return this;
    },

    withConstraints: function(predicates) {
        var self = this;
        if(_.isArray(predicates)) {
            _.each(predicates, function(predicate) { self.withConstraint(predicate); } );
        }
        return self;
    },

    withContext: function(context) {
        this.context = context;
        return this;
    },

    withDebounce: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = _.debounce(fn, milliseconds);
        return this;
    },

    withDelay: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = function(data) {
            setTimeout(fn, milliseconds, data);
        };
        return this;
    },

    withPriority: function(priority) {
        if(_.isNaN(priority)) {
            throw "Priority must be a number";
        }
        this.priority = priority;
        return this;
    },

    withThrottle: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        var fn = this.callback;
        this.callback = _.throttle(fn, milliseconds);
        return this;
    }
};
