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

var MessageCaptor = function(plugUp, unPlug) {
    var _grabMsg = function(data) {
            // We need to ignore system messages, since they could involve captures, replays, etc.
            if(data.exchange !== SYSTEM_EXCHANGE) {
                this.messages.push(data);
            }
        }.bind(this);

    plugUp(_grabMsg);

    this.messages = [];

    this.save = function(batchId, description) {
        unPlug(_grabMsg);
        var captureStore = amplify.store(POSTAL_MSG_STORE_KEY);
        if(!captureStore) {
            captureStore = {};
        }
        captureStore[batchId] = {
                                    batchId: batchId,
                                    description: description,
                                    messages: this.messages
                                };
        amplify.store(POSTAL_MSG_STORE_KEY, captureStore);
    };

    postal.subscribe(SYSTEM_EXCHANGE, "captor.save", function(data) {
        this.save(data.batchId     || new Date().toString(),
                  data.description || "Captured Message Batch");
    }.bind(this));
};

var ReplayContext = function (publish, subscribe) {
    var _batch,
        _continue = true,
        _loadMessages = function(batchId) {
            var msgStore = amplify.store(POSTAL_MSG_STORE_KEY),
                targetBatch = msgStore[batchId];
            if(targetBatch) {
                targetBatch.messages.forEach(function(msg) {
                    msg.timeStamp = new Date(msg.timeStamp);
                });
                _batch = targetBatch;
            }
        },
        _replayImmediate = function() {
            while(_batch.messages.length > 0) {
                if(_continue) {
                    _advanceNext();
                }
                else {
                    break;
                }
            }
        },
        _advanceNext = function() {
            var msg = _batch.messages.shift();
            publish(msg.exchange, msg.topic, msg.data);
        },
        _replayRealTime = function() {
            if(_continue && _batch.messages.length > 0) {
               if(_batch.messages.length > 1) {
                   var span = _batch.messages[1].timeStamp - _batch.messages[0].timeStamp;
                   _advanceNext();
                   setTimeout(_replayRealTime, span);
               }
               else {
                   _advanceNext();
               }
            }
        };

    postal.subscribe(SYSTEM_EXCHANGE, "replay.load", function(data) {
        _continue = false;
        _loadMessages(data);
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.immediate", function() {
        _continue = true;
        _replayImmediate();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.advanceNext", function() {
        _continue = true;
        _advanceNext();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.realTime", function() {
        _continue = true;
        _replayRealTime();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.stop", function() {
        _continue = false;
    });
};

var Postal = function() {
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
        }.bind(this),
        _publish = function(exchange, topic, data) {
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
                                sub.callback(data);
                                sub.onFired();
                            }
                        });
                }
            });
        }.bind(this),
        _mode = NORMAL_MODE,
        _replayContext,
        _captor;

    this.cache = {};

    this.getMode = function() { return _mode; };

    this.wireTaps = [];

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
        if(_mode !== REPLAY_MODE || (_mode === REPLAY_MODE && _exchange === SYSTEM_EXCHANGE)) {

            _topicList.forEach(function(tpc){
                _publish(_exchange, tpc, _data);
            });
        }
    };

    this.subscribe(SYSTEM_EXCHANGE, "mode.set", function(data) {
        if(data.mode) {
            switch(data.mode) {
                case REPLAY_MODE:
                    _mode = REPLAY_MODE;
                    _replayContext = new ReplayContext(_publish.bind(this), this.subscribe.bind(this));
                    _captor = undefined;
                break;
                case CAPTURE_MODE:
                    _mode = CAPTURE_MODE;
                    _captor = new MessageCaptor(function(callback){
                            this.wireTaps.push(callback);
                        }.bind(this),
                        function(callback) {
                            var idx = this.wireTaps.indexOf(callback);
                            if(idx !== -1) {
                                this.wireTaps.splice(idx,1);
                            }
                        }.bind(this));
                break;
                default:
                    _mode = NORMAL_MODE;
                    _replayContext = undefined;
                    _captor = undefined;
                break;
            }
        }
    }.bind(this));
};


var postal = new Postal();

postal.DEFAULT_EXCHANGE = DEFAULT_EXCHANGE;
postal.SYSTEM_EXCHANGE = SYSTEM_EXCHANGE;
postal.NORMAL_MODE = NORMAL_MODE;
postal.CAPTURE_MODE = CAPTURE_MODE;
postal.REPLAY_MODE = REPLAY_MODE;
postal.POSTAL_MSG_STORE_KEY = POSTAL_MSG_STORE_KEY;

exports.postal = postal;