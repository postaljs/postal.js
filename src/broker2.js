var DEFAULT_EXCHANGE = "/",
    _forEachKeyValue = function(object, callback) {
        for(var x in object) {
            if(object.hasOwnProperty(x)) {
                callback(x, object[x]);
            }
        }
    };

var Broker = function() {
    var _regexify = function(topic) {
            if(!this[topic]) {
                this[topic] = topic.replace(".", "\.").replace("*", ".*");
            }
            return this[topic];
        }.bind(this),
        _isTopicMatch = function(topic, comparison) {
            if(!this[topic + '_' + comparison]) {
                this[topic + '_' + comparison] = topic === comparison ||
                    (comparison.indexOf("*") !== -1 && topic.search(_regexify(comparison)) !== -1) ||
                    (topic.indexOf("*") !== -1 && comparison.search(_regexify(topic)) !== -1);
            }
            return this[topic + '_' + comparison];
        }.bind(this);

    this.subscriptions = {};

    this.subscriptions[DEFAULT_EXCHANGE] = {};

    /*
        options object has the following optional members:
        {
            once:       {true || false (true indicates a fire-only-once subscription},
            priority:   {integer value - lower value == higher priority},
            context:    {the "this" context for the callback invocation}
        }
    */
    this.subscribe = function(exchange, topic, callback, options) {
        var _args = slice.call(arguments, 0),
            _exchange,
            _topicList, // we allow multiple topics to be subscribed in one call.,
            _once = false,
            _subData =  {
                            callback: function() { /* placeholder noop */ },
                            priority: 50,
                            context: null,
                            onFired: function() { /* noop */ }
                        },
            _idx,
            _found;

        if(_args.length === 2) { // expecting topic and callback
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _subData.callback = _args[1];
        }
        else if(_args.length === 3 && typeof _args[2] === 'function') { // expecting exchange, topic, callback
            _exchange = exchange;
            _topicList = _args[1].split(/\s/);
            _subData.callback = _args[2];
        }
        else if(_args.length === 3 && typeof _args[2] === 'object') {
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _subData.callback = _args[1];
            _subData.priority = _args[2].priority ? _args[2].priority : 50;
            _subData.context = _args[2].context ? _args[2].context : null;
            _once = _args[2].once ? _args[2].once : false;
        }

        if(_once) {
            _subData.onFired = function() {
                this.unsubscribe.apply(this,[_exchange, _topicList.join(' '), _subData.callback]);
            }.bind(this);
        }

        if(!this.subscriptions[_exchange]) {
            this.subscriptions[_exchange] = {};
        }

        _topicList.forEach(function(tpc) {
            if(!this.subscriptions[_exchange][tpc]) {
                this.subscriptions[_exchange][tpc] = [_subData];
            }
            else {
                _idx = this.subscriptions[_exchange][tpc].length - 1;
                if(this.subscriptions[_exchange][tpc].filter(function(sub) { return sub === callback; }).length === 0) {
                    for(; _idx >= 0; _idx--) {
                        if(this.subscriptions[_exchange][tpc][_idx].priority <= _subData.priority) {
                            this.subscriptions[_exchange][tpc].splice(_idx + 1, 0, _subData);
                            _found = true;
                            break;
                        }
                    }
                    if(!_found) {
                        this.subscriptions[_exchange][tpc].unshift(_subData);
                    }
                }
            }
        }, this);

        // return callback for un-subscribing...
        return function() {
            this.unsubscribe(_exchange, _topicList.join(' '), _subData.callback);
        }.bind(this);
    };

    this.unsubscribe = function(exchange, topic, callback) {
        var _args = slice.call(arguments,0),
            _exchange,
            _topicList, // we allow multiple topics to be unsubscribed in one call.
            _callback;

        if(_args.length === 2) {
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _callback = _args[1];
        }
        else if(_args.length === 3) {
            _exchange = exchange;
            _topicList = topic.split(/\s/);
            _callback = callback;
        }

        _topicList.forEach(function(tpc) {
            if(this.subscriptions[_exchange][tpc]) {
                var _len = this.subscriptions[_exchange][tpc].length,
                    _idx = 0;
                for ( ; _idx < _len; _idx++ ) {
                    if (this.subscriptions[_exchange][tpc][_idx].callback === callback) {
                        this.subscriptions[_exchange][tpc].splice( _idx, 1 );
                        break;
                    }
                }
            }
        },this);
    };

    this.publish = function(exchange, topic, data) {
        var _args = slice.call(arguments,0),
            _exchange,
            _topicList,
            _data;
        if(_args.length == 2) {
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _data = _args[1];
        }
        else {
            _exchange = exchange;
            _topicList = topic.split(/\s/);
            _data = data;
        }

        _topicList.forEach(function(tpc){
            _forEachKeyValue(this.subscriptions[_exchange],function(subTpc, subs) {
                if(_isTopicMatch(tpc, subTpc)) {
                    subs.map(function(sub) { return sub.callback; })
                        .forEach(function(callback) {
                            if(typeof callback === 'function') {
                                callback(data);
                            }
                        });
                }
            });
        }, this);
    };
};
