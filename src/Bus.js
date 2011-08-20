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
        _.each(this.wireTaps,function(tap) {
            tap({
                    exchange:   exchange,
                    topic:      topic,
                    data:       data,
                    timeStamp:  new Date()
                });
        });


        _.each(this.subscriptions[exchange], function(subs, subTpc){
            if(_isTopicMatch(topic, subTpc)) {
                _.each(subs, function(sub) {
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
        this[NORMAL_MODE].setup();
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

