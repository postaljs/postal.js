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