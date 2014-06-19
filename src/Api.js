/* global bindingsResolver, ChannelDefinition, SubscriptionDefinition, _postal, prevPostal, global, Conduit */
/*jshint -W020 */
var fireSub = function(subDef, envelope) {
    if (!subDef.inactive && _postal.configuration.resolver.compare(subDef.topic, envelope.topic)) {
        subDef.callback(envelope.data, envelope);
    }
};
var pubInProgress = 0;
var unSubQueue = [];

function clearUnSubQueue() {
    while (unSubQueue.length) {
        _postal.unsubscribe(unSubQueue.shift());
    }
}

function getSystemMessage(kind, subDef) {
    return {
        channel: _postal.configuration.SYSTEM_CHANNEL,
        topic: "subscription." + kind,
        data: {
            event: "subscription." + kind,
            channel: subDef.channel,
            topic: subDef.topic
        }
    };
}

function getPredicate(options) {
    if (typeof options === "function") {
        return options;
    } else if (!options) {
        return function() {
            return true;
        };
    } else {
        return function(sub) {
            var compared = 0,
                matched = 0;
            _.each(options, function(val, prop) {
                compared += 1;
                if (
                    // We use the bindings resolver to compare the options.topic to subDef.topic
                    (prop === "topic" && _postal.configuration.resolver.compare(sub.topic, options.topic))
                    // We need to account for the context possibly being available on callback due to Conduit
                    || (prop === "context" && options.context === (sub.callback.context && sub.callback.context() || sub.context))
                    // Any other potential prop/value matching outside topic & context...
                    || (sub[prop] === options[prop])) {
                    matched += 1;
                }
            });
            return compared === matched;
        };
    }
}

function subscribe(options) {
    var subDef = new SubscriptionDefinition(options.channel || this.configuration.DEFAULT_CHANNEL, options.topic, options.callback);
    var channel = this.subscriptions[subDef.channel];
    var subs;
    if (!channel) {
        channel = this.subscriptions[subDef.channel] = {};
    }
    subs = this.subscriptions[subDef.channel][subDef.topic];
    if (!subs) {
        subs = this.subscriptions[subDef.channel][subDef.topic] = [];
    }
    subs.push(subDef);
    return subDef;
}

function publish(envelope) {
    ++pubInProgress;
    envelope.channel = envelope.channel || this.configuration.DEFAULT_CHANNEL;
    envelope.timeStamp = new Date();
    _.each(this.wireTaps, function(tap) {
        tap(envelope.data, envelope);
    });
    if (this.subscriptions[envelope.channel]) {
        _.each(this.subscriptions[envelope.channel], function(subscribers) {
            var idx = 0,
                len = subscribers.length,
                subDef;
            while (idx < len) {
                if (subDef = subscribers[idx++]) {
                    fireSub(subDef, envelope);
                }
            }
        });
    }
    if (--pubInProgress === 0) {
        clearUnSubQueue();
    }
}

function unsubscribe() {
    var idx = 0;
    var subs = Array.prototype.slice.call(arguments, 0);
    var subDef;
    while (subDef = subs.shift()) {
        if (pubInProgress) {
            unSubQueue.push(subDef);
            return;
        }
        if (this.subscriptions[subDef.channel] && this.subscriptions[subDef.channel][subDef.topic]) {
            var len = this.subscriptions[subDef.channel][subDef.topic].length;
            idx = 0;
            while (idx < len) {
                if (this.subscriptions[subDef.channel][subDef.topic][idx] === subDef) {
                    this.subscriptions[subDef.channel][subDef.topic].splice(idx, 1);
                    break;
                }
                idx += 1;
            }
        }
        _postal.publish(getSystemMessage("removed", subDef));
    }
}

_postal = {
    configuration: {
        resolver: bindingsResolver,
        DEFAULT_CHANNEL: "/",
        SYSTEM_CHANNEL: "postal"
    },
    subscriptions: {},
    wireTaps: [],

    ChannelDefinition: ChannelDefinition,
    SubscriptionDefinition: SubscriptionDefinition,

    channel: function(channelName) {
        return new ChannelDefinition(channelName);
    },

    addWireTap: function(callback) {
        var self = this;
        self.wireTaps.push(callback);
        return function() {
            var idx = self.wireTaps.indexOf(callback);
            if (idx !== -1) {
                self.wireTaps.splice(idx, 1);
            }
        };
    },

    noConflict: function() {
        if (typeof window === "undefined" || (typeof window !== "undefined" && typeof define === "function" && define.amd)) {
            throw new Error("noConflict can only be used in browser clients which aren't using AMD modules");
        }
        global.postal = prevPostal;
        return this;
    },

    getSubscribersFor: function(options) {
        var result = [];
        _.each(this.subscriptions, function(channel) {
            _.each(channel, function(subList) {
                result = result.concat(_.filter(subList, getPredicate(options)));
            });
        });
        return result;
    },

    reset: function() {
        this.unsubscribeFor();
        this.configuration.resolver.reset();
        this.subscriptions = {};
    },

    unsubscribeFor: function(options) {
        var toDispose = [];
        if (this.subscriptions) {
            toDispose = this.getSubscribersFor(options);
            this.unsubscribe.apply(this, toDispose);
        }
    }
};

_postal.subscribe = new Conduit.Sync({
    target: subscribe,
    context: _postal
});

_postal.publish = Conduit.Async({
    target: publish,
    context: _postal
});

_postal.unsubscribe = new Conduit.Sync({
    target: unsubscribe,
    context: _postal
});

_postal.subscribe.after(function(subDef /*, options */ ) {
    _postal.publish(getSystemMessage("created", subDef));
});

_postal.subscriptions[_postal.configuration.SYSTEM_CHANNEL] = {};