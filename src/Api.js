/* global bindingsResolver, ChannelDefinition, SubscriptionDefinition, _postal, prevPostal, global */
/*jshint -W020 */
var fireSub = function(subDef, envelope) {
    if (!subDef.inactive && _postal.configuration.resolver.compare(subDef.topic, envelope.topic)) {
        subDef.callback.call(subDef.context || this, envelope.data, envelope);
    }
};
var pubInProgress = 0;
var unSubQueue = [];
var clearUnSubQueue = function() {
    while (unSubQueue.length) {
        _postal.unsubscribe(unSubQueue.shift());
    }
};
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

    subscribe: function(options) {
        var subDef = new SubscriptionDefinition(options.channel || this.configuration.DEFAULT_CHANNEL, options.topic, options.callback);
        var channel = this.subscriptions[subDef.channel];
        var subs;
        this.publish({
            channel: this.configuration.SYSTEM_CHANNEL,
            topic: "subscription.created",
            data: {
                event: "subscription.created",
                channel: subDef.channel,
                topic: subDef.topic
            }
        });
        if (!channel) {
            channel = this.subscriptions[subDef.channel] = {};
        }
        subs = this.subscriptions[subDef.channel][subDef.topic];
        if (!subs) {
            subs = this.subscriptions[subDef.channel][subDef.topic] = [];
        }
        subs.push(subDef);
        return subDef;
    },

    publish: function(envelope) {
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
    },

    unsubscribe: function() {
        var idx = 0;
        var subs = Array.prototype.slice.call(arguments, 0);
        var subDef;
        while (subDef = subs.shift()) {
            if (pubInProgress) {
                unSubQueue.push(subDef);
                return;
            }
            if (this.subscriptions[subDef.channel] && this.subscriptions[subDef.channel][subDef.topic]) {
                var len = this.subscriptions[subDef.channel][subDef.topic].length,
                    idx = 0;
                while (idx < len) {
                    if (this.subscriptions[subDef.channel][subDef.topic][idx] === subDef) {
                        this.subscriptions[subDef.channel][subDef.topic].splice(idx, 1);
                        break;
                    }
                    idx += 1;
                }
            }
            this.publish({
                channel: this.configuration.SYSTEM_CHANNEL,
                topic: "subscription.removed",
                data: {
                    event: "subscription.removed",
                    channel: subDef.channel,
                    topic: subDef.topic
                }
            });
        }
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

    getSubscribersFor: function() {
        var channel = arguments[0],
            tpc = arguments[1];
        if (arguments.length === 1) {
            channel = arguments[0].channel || this.configuration.DEFAULT_CHANNEL;
            tpc = arguments[0].topic;
        }
        if (this.subscriptions[channel] &&
            Object.prototype.hasOwnProperty.call(this.subscriptions[channel], tpc)) {
            return this.subscriptions[channel][tpc];
        }
        return [];
    },

    reset: function() {
        if (this.subscriptions) {
            _.each(this.subscriptions, function(channel) {
                _.each(channel, function(topic) {
                    while (topic.length) {
                        topic.pop().unsubscribe();
                    }
                });
            });
            this.subscriptions = {};
        }
        this.configuration.resolver.reset();
    }
};
_postal.subscriptions[_postal.configuration.SYSTEM_CHANNEL] = {};