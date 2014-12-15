/**
 * postal - Pub/Sub library providing wildcard subscriptions, complex message handling, etc.  Works server and client-side.
 * Author: Jim Cowart (http://freshbrewedcode.com/jimcowart)
 * Version: v0.11.1
 * Url: http://github.com/postaljs/postal.js
 * License(s): MIT
 */
(function (root, factory) { /* istanbul ignore if  */
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(function () {
            return factory(root);
        }); /* istanbul ignore else */
    } else if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = factory(this);
    } else {
        // Browser globals
        root.postal = factory(root);
    }
}(this, function (global, undefined) {
    var _postal;
    var prevPostal = global.postal;
    var ChannelDefinition = function (channelName, bus) {
        this.bus = bus;
        this.channel = channelName || _postal.configuration.DEFAULT_CHANNEL;
    };
    ChannelDefinition.prototype.subscribe = function () {
        return this.bus.subscribe({
            channel: this.channel,
            topic: (arguments.length === 1 ? arguments[0].topic : arguments[0]),
            callback: (arguments.length === 1 ? arguments[0].callback : arguments[1])
        });
    };
    ChannelDefinition.prototype.publish = function () {
        var envelope = arguments.length === 1 ? (Object.prototype.toString.call(arguments[0]) === "[object String]" ? {
            topic: arguments[0]
        } : arguments[0]) : {
            topic: arguments[0],
            data: arguments[1]
        };
        envelope.channel = this.channel;
        this.bus.publish(envelope);
    };
    var SubscriptionDefinition = function (channel, topic, callback) {
        if (arguments.length !== 3) {
            throw new Error("You must provide a channel, topic and callback when creating a SubscriptionDefinition instance.");
        }
        if (topic.length === 0) {
            throw new Error("Topics cannot be empty");
        }
        this.channel = channel;
        this.topic = topic;
        this.callback = callback;
        this.pipeline = [];
        this.cacheKeys = [];
        this._context = undefined;
    };
    var clone = function (data) {
        var newObj = {};
        for (var i in data) {
            if (data[i] && typeof data[i] === "object") {
                newObj[i] = clone(data[i]);
            } else {
                newObj[i] = data[i];
            }
        }
        return newObj;
    };
    var equals = function (x, y) {
        // if both x and y are null or undefined and exactly the same
        if (x === y) {
            return true;
        }
        // if they are not strictly equal, they both need to be Objects
        if (!(x instanceof Object) || !(y instanceof Object)) {
            return false;
        }
        // they must have the exact same prototype chain, the closest we can do is
        // test there constructor.
        if (x.constructor !== y.constructor) {
            return false;
        }
        for (var p in x) {
            // other properties were tested using x.constructor === y.constructor
            if (!x.hasOwnProperty(p)) {
                continue;
            }
            // allows to compare x[ p ] and y[ p ] when set to undefined
            if (!y.hasOwnProperty(p)) {
                return false;
            }
            // if they have the same strict value or identity then they are equal
            if (x[p] === y[p]) {
                continue;
            }
            // Numbers, Strings, Functions, Booleans must be strictly equal
            if (typeof(x[p]) !== "object") {
                return false;
            }
            // Objects and Arrays must be tested recursively
            if (!equals(x[p], y[p])) {
                return false;
            }
        }
        for (p in y) {
            // allows x[ p ] to be set to undefined
            if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) {
                return false;
            }
        }
        return true;
    };
    var ConsecutiveDistinctPredicate = function () {
        var previous;
        return function (data) {
            var eq = false;
            if (typeof data === "string") {
                eq = data === previous;
                previous = data;
            } else {
                eq = equals(data, previous);
                previous = clone(data);
            }
            return !eq;
        };
    };
    var DistinctPredicate = function DistinctPredicateFactory() {
        var previous = [];
        return function DistinctPredicate(data) {
            var isDistinct = true;
            previous.every(function (p) {
                var type = typeof data;
                var isObject = type === "function" || (data && type === "object") || false;
                if (isObject || Array.isArray(data)) {
                    if (equals(data, p)) {
                        isDistinct = false;
                        return false;
                    }
                }
                if (data === p) {
                    isDistinct = false;
                    return false;
                }
                return true;
            });
            if (isDistinct) {
                previous.push(data);
            }
            return isDistinct;
        };
    };
    var debounceFn = function (func, wait, immediate) {
        var timeout;
        return function () {
            var context = this,
                args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                func.apply(context, args);
            }
        };
    };
    var throttleFn = function (fn, threshhold, scope) {
        threshhold = threshhold || 250;
        var last, deferTimer;
        return function () {
            var context = scope || this;
            var now = +new Date(),
                args = arguments;
            if (last && now < last + threshhold) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
                    last = now;
                    fn.apply(context, args);
                }, threshhold);
            } else {
                last = now;
                fn.apply(context, args);
            }
        };
    };
    SubscriptionDefinition.prototype = {
        "catch": function (errorHandler) {
            var original = this.callback;
            var safeCallback = function () {
                try {
                    original.apply(this, arguments);
                } catch (err) {
                    errorHandler(err, arguments[0]);
                }
            };
            this.callback = safeCallback;
            return this;
        },
        defer: function defer() {
            return this.delay(0);
        },
        disposeAfter: function disposeAfter(maxCalls) {
            if (typeof maxCalls !== "number" || maxCalls <= 0) {
                throw new Error("The value provided to disposeAfter (maxCalls) must be a number greater than zero.");
            }
            var self = this;
            var n = maxCalls;
            var dispose = function () {
                if (--n < 1) {
                    return self.unsubscribe();
                }
            };
            self.pipeline.push(function (data, env, next) {
                next(data, env);
                dispose();
            });
            return self;
        },
        distinct: function distinct() {
            return this.constraint(new DistinctPredicate());
        },
        distinctUntilChanged: function distinctUntilChanged() {
            return this.constraint(new ConsecutiveDistinctPredicate());
        },
        invokeSubscriber: function invokeSubscriber(data, env) {
            if (!this.inactive) {
                var self = this;
                var pipeline = self.pipeline;
                var len = pipeline.length;
                var context = self._context;
                var idx = -1;
                if (!len) {
                    self.callback.call(context, data, env);
                } else {
                    pipeline = pipeline.concat([self.callback]);
                    var step = function step(d, e) {
                        idx += 1;
                        if (idx < len) {
                            pipeline[idx].call(context, d, e, step);
                        } else {
                            self.callback.call(context, d, e);
                        }
                    };
                    step(data, env, 0);
                }
            }
        },
        logError: function logError() { /* istanbul ignore else */
            if (console) {
                var report;
                if (console.warn) {
                    report = console.warn;
                } else {
                    report = console.log;
                }
                this["catch"](report);
            }
            return this;
        },
        once: function once() {
            return this.disposeAfter(1);
        },
        subscribe: function subscribe(callback) {
            this.callback = callback;
            return this;
        },
        unsubscribe: function unsubscribe() { /* istanbul ignore else */
            if (!this.inactive) {
                _postal.unsubscribe(this);
            }
        },
        constraint: function constraint(predicate) {
            if (typeof predicate !== "function") {
                throw new Error("Predicate constraint must be a function");
            }
            this.pipeline.push(function (data, env, next) {
                if (predicate.call(this, data, env)) {
                    next(data, env);
                }
            });
            return this;
        },
        constraints: function constraints(predicates) {
            var self = this; /* istanbul ignore else */
            if (Array.isArray(predicates)) {
                predicates.forEach(function (predicate) {
                    self.constraint(predicate);
                });
            }
            return self;
        },
        context: function contextSetter(context) {
            this._context = context;
            return this;
        },
        debounce: function debounce(milliseconds, immediate) {
            if (typeof milliseconds !== "number") {
                throw new Error("Milliseconds must be a number");
            }
            var fn = function (data, env, next) {
                next(data, env);
            };
            this.pipeline.push(
            debounceFn(function (data, env, next) {
                next(data, env);
            }, milliseconds, !! immediate));
            return this;
        },
        delay: function delay(milliseconds) {
            if (typeof milliseconds !== "number") {
                throw new Error("Milliseconds must be a number");
            }
            var self = this;
            self.pipeline.push(function (data, env, next) {
                setTimeout(function () {
                    next(data, env);
                }, milliseconds);
            });
            return this;
        },
        throttle: function throttle(milliseconds) {
            if (typeof milliseconds !== "number") {
                throw new Error("Milliseconds must be a number");
            }
            var fn = function (data, env, next) {
                next(data, env);
            };
            this.pipeline.push(throttleFn(fn, milliseconds));
            return this;
        }
    };
    // Backwards Compatibility
    // WARNING: these will be removed by version 0.13


    function warnOnDeprecation(oldMethod, newMethod) {
        return function () {
            if (console.warn || console.log) {
                var msg = "Warning, the " + oldMethod + " method has been deprecated. Please use " + newMethod + " instead.";
                if (console.warn) {
                    console.warn(msg);
                } else {
                    console.log(msg);
                }
            }
            return SubscriptionDefinition.prototype[newMethod].apply(this, arguments);
        };
    }
    var oldMethods = ["withConstraint", "withConstraints", "withContext", "withDebounce", "withDelay", "withThrottle"];
    var newMethods = ["constraint", "constraints", "context", "debounce", "delay", "throttle"];
    for (var i = 0; i < 6; i++) {
        var oldMethod = oldMethods[i];
        SubscriptionDefinition.prototype[oldMethod] = warnOnDeprecation(oldMethod, newMethods[i]);
    }
    var bindingsResolver = {
        cache: {},
        regex: {},
        compare: function compare(binding, topic) {
            var pattern;
            var rgx;
            var prevSegment;
            var result = (this.cache[topic + "-" + binding]);
            // result is cached?
            if (result === true) {
                return result;
            }
            // plain string matching?
            if (binding.indexOf("#") === -1 && binding.indexOf("*") === -1) {
                result = this.cache[topic + "-" + binding] = (topic === binding);
                return result;
            }
            // ah, regex matching, then
            if (!(rgx = this.regex[binding])) {
                pattern = "^" + binding.split(".").map(function mapTopicBinding(segment) {
                    var res = "";
                    if ( !! prevSegment) {
                        res = prevSegment !== "#" ? "\\.\\b" : "\\b";
                    }
                    if (segment === "#") {
                        res += "[\\s\\S]*";
                    } else if (segment === "*") {
                        res += "[^.]+";
                    } else {
                        res += segment;
                    }
                    prevSegment = segment;
                    return res;
                }).join("") + "$";
                rgx = this.regex[binding] = new RegExp(pattern);
            }
            result = this.cache[topic + "-" + binding] = rgx.test(topic);
            return result;
        },
        reset: function reset() {
            this.cache = {};
            this.regex = {};
        }
    };
    var pubInProgress = 0;
    var unSubQueue = [];
    function clearUnSubQueue() {
        while (unSubQueue.length) {
            _postal.unsubscribe(unSubQueue.shift());
        }
    }
    function getCachePurger(subDef, key, cache) {
        return function (sub, i, list) {
            if (sub === subDef) {
                list.splice(i, 1);
            }
            if (list.length === 0) {
                delete cache[key];
            }
        };
    }
    function getCacher(configuration, topic, cache, cacheKey, done) {
        return function (subDef) {
            if (configuration.resolver.compare(subDef.topic, topic)) {
                cache.push(subDef);
                subDef.cacheKeys.push(cacheKey);
                if (done) {
                    done(subDef);
                }
            }
        };
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
    var sysCreatedMessage = getSystemMessage.bind(this, "created");
    var sysRemovedMessage = getSystemMessage.bind(this, "removed");
    function getPredicate(options, resolver) {
        if (typeof options === "function") {
            return options;
        } else if (!options) {
            return function () {
                return true;
            };
        } else {
            return function (sub) {
                var compared = 0,
                    matched = 0,
                    prop, val;
                for (prop in options) { //, function( val, prop ) {
                    val = options[prop];
                    compared += 1;
                    if (
                    // We use the bindings resolver to compare the options.topic to subDef.topic
                    (prop === "topic" && resolver.compare(sub.topic, options.topic)) || (prop === "context" && options.context === sub._context)
                    // Any other potential prop/value matching outside topic & context...
                    || (sub[prop] === options[prop])) {
                        matched += 1;
                    }
                }
                return compared === matched;
            };
        }
    }
    _postal = {
        cache: {},
        configuration: {
            resolver: bindingsResolver,
            DEFAULT_CHANNEL: "/",
            SYSTEM_CHANNEL: "postal",
            enableSystemMessages: true,
            cacheKeyDelimiter: "|"
        },
        subscriptions: {},
        wireTaps: [],
        ChannelDefinition: ChannelDefinition,
        SubscriptionDefinition: SubscriptionDefinition,
        channel: function channel(channelName) {
            return new ChannelDefinition(channelName, this);
        },
        addWireTap: function addWireTap(callback) {
            var self = this;
            self.wireTaps.push(callback);
            return function () {
                var idx = self.wireTaps.indexOf(callback);
                if (idx !== -1) {
                    self.wireTaps.splice(idx, 1);
                }
            };
        },
        noConflict: function noConflict() { /* istanbul ignore else */
            if (typeof window === "undefined" || (typeof window !== "undefined" && typeof define === "function" && define.amd)) {
                throw new Error("noConflict can only be used in browser clients which aren't using AMD modules");
            }
            global.postal = prevPostal;
            return this;
        },
        getSubscribersFor: function getSubscribersFor(options) {
            var result = [];
            var self = this;
            var key, channel, subkey, subList;
            for (key in self.subscriptions) {
                channel = self.subscriptions[key];
                for (subkey in channel) {
                    subList = channel[subkey];
                    result = result.concat(subList.filter(getPredicate(options, self.configuration.resolver)));
                }
            }
            return result;
        },
        publish: function publish(envelope) {
            ++pubInProgress;
            var configuration = this.configuration;
            var channel = envelope.channel = envelope.channel || configuration.DEFAULT_CHANNEL;
            var topic = envelope.topic;
            envelope.timeStamp = new Date();
            if (this.wireTaps.length) {
                this.wireTaps.forEach(function (tap) {
                    tap(envelope.data, envelope, pubInProgress);
                });
            }
            var cacheKey = channel + configuration.cacheKeyDelimiter + topic;
            var cache = this.cache[cacheKey];
            var key;
            if (!cache) {
                cache = this.cache[cacheKey] = [];
                var cacherFn = getCacher(
                configuration, topic, cache, cacheKey, function (candidate) {
                    candidate.invokeSubscriber(envelope.data, envelope);
                });
                var candidates;
                for (key in this.subscriptions[channel]) {
                    candidates = this.subscriptions[channel][key];
                    candidates.forEach(cacherFn);
                }
            } else {
                var subDef;
                for (key in cache) {
                    subDef = cache[key];
                    subDef.invokeSubscriber(envelope.data, envelope);
                }
            }
            if (--pubInProgress === 0) {
                clearUnSubQueue();
            }
        },
        reset: function reset() {
            this.unsubscribeFor();
            this.configuration.resolver.reset();
            this.subscriptions = {};
        },
        subscribe: function subscribe(options) {
            var subscriptions = this.subscriptions;
            var subDef = new SubscriptionDefinition(options.channel || this.configuration.DEFAULT_CHANNEL, options.topic, options.callback);
            var channel = subscriptions[subDef.channel];
            var channelLen = subDef.channel.length;
            var configuration = this.configuration;
            var subs;
            if (!channel) {
                channel = subscriptions[subDef.channel] = {};
            }
            subs = subscriptions[subDef.channel][subDef.topic];
            if (!subs) {
                subs = subscriptions[subDef.channel][subDef.topic] = [];
            }
            // First, add the SubscriptionDefinition to the channel list
            subs.push(subDef);
            // Next, add the SubscriptionDefinition to any relevant existing cache(s)
            var list, cacheKey;
            for (cacheKey in this.cache) {
                list = this.cache[cacheKey];
                if (cacheKey.substr(0, channelLen) === subDef.channel) {
                    getCacher(
                    configuration, cacheKey.split(configuration.cacheKeyDelimiter)[1], list, cacheKey)(subDef);
                }
            } /* istanbul ignore else */
            if (this.configuration.enableSystemMessages) {
                this.publish(sysCreatedMessage(subDef));
            }
            return subDef;
        },
        unsubscribe: function unsubscribe() {
            var unSubLen = arguments.length;
            var unSubIdx = 0;
            var subDef;
            var channelSubs;
            var topicSubs;
            var idx;
            for (; unSubIdx < unSubLen; unSubIdx++) {
                subDef = arguments[unSubIdx];
                subDef.inactive = true;
                if (pubInProgress) {
                    unSubQueue.push(subDef);
                    return;
                }
                channelSubs = this.subscriptions[subDef.channel];
                topicSubs = channelSubs && channelSubs[subDef.topic]; /* istanbul ignore else */
                if (topicSubs) {
                    var len = topicSubs.length;
                    idx = 0;
                    // remove SubscriptionDefinition from channel list
                    while (idx < len) { /* istanbul ignore else */
                        if (topicSubs[idx] === subDef) {
                            topicSubs.splice(idx, 1);
                            break;
                        }
                        idx += 1;
                    }
                    // remove SubscriptionDefinition from cache
                    if (subDef.cacheKeys && subDef.cacheKeys.length) {
                        var key;
                        while (key = subDef.cacheKeys.pop()) {
                            this.cache[key].forEach(getCachePurger(subDef, key, this.cache));
                        }
                    }
                    if (topicSubs.length === 0) {
                        delete channelSubs[subDef.topic];
                        if (!Object.keys(channelSubs).length) {
                            delete this.subscriptions[subDef.channel];
                        }
                    }
                }
                if (this.configuration.enableSystemMessages) {
                    this.publish(sysRemovedMessage(subDef));
                }
            }
        },
        unsubscribeFor: function unsubscribeFor(options) {
            var toDispose = []; /* istanbul ignore else */
            if (this.subscriptions) {
                toDispose = this.getSubscribersFor(options);
                this.unsubscribe.apply(this, toDispose);
            }
        }
    };
    _postal.subscriptions[_postal.configuration.SYSTEM_CHANNEL] = {};
    if (global && Object.prototype.hasOwnProperty.call(global, "__postalReady__") && Array.isArray(global.__postalReady__)) {
        while (global.__postalReady__.length) {
            global.__postalReady__.shift().onReady(_postal);
        }
    }
    return _postal;
}));