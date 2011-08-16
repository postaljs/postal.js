/*
    postal.js
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.0.1
*/

var isArray = function(value) {
        var s = typeof value;
        if (s === 'object') {
            if (value) {
                if (typeof value.length === 'number' &&
                        !(value.propertyIsEnumerable('length')) &&
                        typeof value.splice === 'function') {
                    s = 'array';
                }
            }
        }
        return s === 'array';
    },
    slice = [].slice,
    DEFAULT_EXCHANGE = "/",
    SYSTEM_EXCHANGE = "postal",
    NORMAL_MODE = "Normal",
    CAPTURE_MODE = "Capture",
    REPLAY_MODE = "Replay",
    POSTAL_MSG_STORE_KEY = "postal.captured",
    _forEachKeyValue = function(object, callback) {
        for(var x in object) {
            if(object.hasOwnProperty(x)) {
                callback(x, object[x]);
            }
        }
    };

var Bus = function() {
    var _regexify = function(topic) {
            if(!this.cache[topic]) {
                this.cache[topic] = topic.replace(".", "\.").replace("*", ".*");
            }
            return this.cache[topic];
        }.bind(this),
        _isTopicMatch = function(topic, comparison) {
            if(!this.cache[topic + '_' + comparison]) {
                this.cache[topic + '_' + comparison] = topic === comparison ||
                    (comparison.indexOf("*") !== -1 && topic.search(_regexify(comparison)) !== -1) ||
                    (topic.indexOf("*") !== -1 && comparison.search(_regexify(topic)) !== -1);
            }
            return this.cache[topic + '_' + comparison];
        }.bind(this);

    this.context = undefined;

    this.cache = {};

    this.wireTaps = [];

    this.subscriptions = {};

    this.subscriptions[DEFAULT_EXCHANGE] = {};

    this.publish = function(exchange, topic, data) {
        this.wireTaps.forEach(function(tap) {
            tap({
                exchange:   exchange,
                topic:      topic,
                data:       data,
                timeStamp:  new Date()
            });
        });

        _forEachKeyValue(this.subscriptions[exchange],function(subTpc, subs) {
            if(_isTopicMatch(topic, subTpc)) {
                subs.forEach(function(sub) {
                        if(typeof sub.callback === 'function') {
                            sub.callback.apply(sub.context, [data]);
                            sub.onFired();
                        }
                    });
            }
        });
    };

    this.mode = NORMAL_MODE;

    this[NORMAL_MODE] = {
                            setup: function() {
                                this.mode = NORMAL_MODE;
                                this.context = undefined;
                            }.bind(this),
                            teardown: function() {
                                // no-op
                            }.bind(this)
                        };

    this.init = function() {
        this[NORMAL_MODE]();
        var systemEx = this.subscriptions[SYSTEM_EXCHANGE] || {};
        this.subscriptions = {};
        this.subscriptions[DEFAULT_EXCHANGE] = {};
        this.subscriptions[SYSTEM_EXCHANGE] = systemEx;
        this.cache = {};
        this.wireTaps = [];
    };
};

var bus = new Bus(),
    hashCheck = function() {
        var regex = /postalmode=(\w+)&*/i,
            match = regex.exec(window.location.hash),
            mode;
        if(match && match.length >= 2) {
            mode = match[1];
        }
        if(mode) {
            postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", {mode: mode });
        };
    };
$(function(){
    hashCheck();
    window.addEventListener("hashchange", hashCheck)
});

var Postal = function() {

    this.getMode = function() { return bus.mode; };

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
                            callback: function() { /* placeholder no-op */ },
                            priority: 50,
                            context: null,
                            onFired: function() { /* placeholder no-op */ }
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
        else if(_args.length === 3 && typeof _args[2] === 'object') { // expecting topic, callback and options
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _subData.callback = _args[1];
            _subData.priority = _args[2].priority ? _args[2].priority : 50;
            _subData.context = _args[2].context ? _args[2].context : null;
            _once = _args[2].once ? _args[2].once : false;
        }
        else {
            _exchange = exchange;
            _topicList = topic.split(/\s/);
            _subData.callback = callback;
            _subData.priority = options.priority ? options.priority : 50;
            _subData.context = options.context ? options.context : null;
            _once = options.once ? options.once : false;
        }

        if(_once) {
            _subData.onFired = function() {
                this.unsubscribe.apply(this,[_exchange, _topicList.join(' '), _subData.callback]);
            }.bind(this);
        }

        if(!bus.subscriptions[_exchange]) {
            bus.subscriptions[_exchange] = {};
        }

        _topicList.forEach(function(tpc) {
            if(!bus.subscriptions[_exchange][tpc]) {
                bus.subscriptions[_exchange][tpc] = [_subData];
            }
            else {
                _idx = bus.subscriptions[_exchange][tpc].length - 1;
                if(bus.subscriptions[_exchange][tpc].filter(function(sub) { return sub === callback; }).length === 0) {
                    for(; _idx >= 0; _idx--) {
                        if(bus.subscriptions[_exchange][tpc][_idx].priority <= _subData.priority) {
                            bus.subscriptions[_exchange][tpc].splice(_idx + 1, 0, _subData);
                            _found = true;
                            break;
                        }
                    }
                    if(!_found) {
                        bus.subscriptions[_exchange][tpc].unshift(_subData);
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
            if(bus.subscriptions[_exchange][tpc]) {
                var _len = bus.subscriptions[_exchange][tpc].length,
                    _idx = 0;
                for ( ; _idx < _len; _idx++ ) {
                    if (bus.subscriptions[_exchange][tpc][_idx].callback === callback) {
                        bus.subscriptions[_exchange][tpc].splice( _idx, 1 );
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
        if(_args.length === 1) {
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _data = {};
        }
        else if(_args.length === 2 && typeof _args[1] === 'object') {
            _exchange = DEFAULT_EXCHANGE;
            _topicList = _args[0].split(/\s/);
            _data = _args[1] || {};
        }
        else if(_args.length === 2) {
            _exchange = _args[0];
            _topicList = _args[1].split(/\s/);
            _data = {};
        }
        else {
            _exchange = exchange;
            _topicList = topic.split(/\s/);
            _data = data || {};
        }
        if(bus.mode !== REPLAY_MODE || (bus.mode === REPLAY_MODE && _exchange === SYSTEM_EXCHANGE)) {

            _topicList.forEach(function(tpc){
                bus.publish(_exchange, tpc, _data);
            });
        }
    };

    this.reset = function() {
        bus.init();
    };

    this.addBusBehavior = function(behaviorName, setup, teardown) {
        if(!bus[behaviorName]) {
            bus[behaviorName] = {};
        }
        bus[behaviorName].setup = function() {
            bus.mode = behaviorName;
            setup(bus);
        };
        if(teardown) {
            bus[behaviorName].teardown = function() { teardown(bus); }
        }
        else {
            bus[behaviorName].teardown = function() { /* no-op */ }
        }
    };

    this.subscribe(SYSTEM_EXCHANGE, "mode.set", function(data) {
        if(data.mode && bus[data.mode]) {
            bus[bus.mode].teardown();
            bus[data.mode].setup(data);
        }
    }.bind(this));

    this.addWireTap = function(callback) {
        bus.wireTaps.push(callback);
        return function() {
            var idx = bus.wireTaps.indexOf(callback);
            if(idx !== -1) {
                bus.wireTaps.splice(idx,1);
            }
        };
    };
};

var postal = new Postal();
postal.DEFAULT_EXCHANGE = DEFAULT_EXCHANGE;
postal.SYSTEM_EXCHANGE = SYSTEM_EXCHANGE;
postal.NORMAL_MODE = NORMAL_MODE;
postal.CAPTURE_MODE = CAPTURE_MODE;
postal.REPLAY_MODE = REPLAY_MODE;
postal.POSTAL_MSG_STORE_KEY = POSTAL_MSG_STORE_KEY;

exports.postal = postal;