var DEFAULT_EXCHANGE = "/",
    DEFAULT_PRIORITY = 50,
    DEFAULT_DISPOSEAFTER = 0,
    NO_OP = function() { };

var ChannelDefinition = function(exchange, topic) {
    this.configuration = {
        exchange: exchange || DEFAULT_EXCHANGE,
        topic: topic || "",
        callback: NO_OP,
        priority: DEFAULT_PRIORITY,
        constraints: [],
        disposeAfter: DEFAULT_DISPOSEAFTER,
        onHandled: NO_OP,
        context: null
    };
} ;

ChannelDefinition.prototype = {
    exchange: function(exchange) {
        this.configuration.exchange = exchange;
        return this;
    },

    topic: function(topic) {
        this.configuration.topic = topic;
        return this;
    },

    defer: function() {
        this.configuration.defer = true;
        return this;
    },

    disposeAfter: function(receiveCount) {
        if(_.isNaN(receiveCount)) {
            throw "The value provided to disposeAfter (receiveCount) must be a number";
        }
        this.configuration.disposeAfter = receiveCount;
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
        this.configuration.onHandled = callback;
        return this;
    },

    withConstraint: function(predicate) {
        if(! _.isFunction(predicate)) {
            throw "Predicate constraint must be a function";
        }
        this.configuration.constraints.push(predicate);
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
        this.configuration.context = context;
        return this;
    },

    withDebounce: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.debounce = milliseconds;
        return this;
    },

    withDelay: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.delay = milliseconds;
        return this;
    },

    withPriority: function(priority) {
        if(_.isNaN(priority)) {
            throw "Priority must be a number";
        }
        this.configuration.priority = priority;
        return this;
    },

    withThrottle: function(milliseconds) {
        if(_.isNaN(milliseconds)) {
            throw "Milliseconds must be a number";
        }
        this.configuration.throttle = milliseconds;
        return this;
    },

    subscribe: function(callback) {
        this.configuration.callback = callback || NO_OP;
        return postal.subscribe(this.configuration);
    },

    publish: function(data) {
        postal.publish({
                        exchange: this.configuration.exchange,
                        data: data,
                        topic: this.configuration.topic
                       });
    }
};