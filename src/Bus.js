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
                            },
                            teardown: function() {
                                // no-op
                            }
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

var bus = new Bus();

