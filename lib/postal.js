/**
 * postal - Pub/Sub library providing wildcard subscriptions, complex message handling, etc.  Works server and client-side.
 * Author: Jim Cowart (http://ifandelse.com)
 * Version: v0.12.4
 * Url: http://github.com/postaljs/postal.js
 * License(s): MIT
 */
(function (root, factory) {
    // get mindash implementation
    var minDash;
    var minDash = {
        after: function (n, func) {
            n = Number.isFinite(n = +n) ? n : 0;
            return function () {
                if (--n < 1) {
                    return func.apply(this, arguments);
                }
            };
        },
        any: function (array, predicate) {
            var index = -1,
                length = array.length;
            while (++index < length) {
                if (predicate(array[index], index, array)) {
                    return true;
                }
            }
            return false;
        },
        bind: function (func, thisArg, arg) {
            return func.bind(thisArg, arg);
        },
        clone: function (obj) {
            if (obj === null || typeof(obj) !== "object") {
                return obj;
            }
            var temp = obj.constructor(); // changed
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    temp[key] = minDash.clone(obj[key]);
                }
            }
            return temp;
        },
        debounce: function (func, wait, immediate) {
            var timeout;
            return function () {
                var context = this;
                var args = arguments;
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
        },
        each: function (item, func) {
            if (Array.isArray(item)) {
                return item.forEach(func);
            } else {
                for (var key in item) {
                    if (item.hasOwnProperty(key)) {
                        func(item[key], key);
                    }
                }
            }
        },
        filter: function (arr, func) {
            return arr.filter(func);
        },
        isArray: function (arr) {
            return Array.isArray(arr);
        },
        isEmpty: function (value) {
            if (value === null) {
                return true;
            }
            return !Object.keys(value).length;
        },
        isEqual: function (x, y) {
            if (x === y) {
                return true;
            }
            if (!(x instanceof Object) || !(y instanceof Object)) {
                return false;
            }
            if (x.constructor !== y.constructor) {
                return false;
            }
            for (var p in x) {
                if (!x.hasOwnProperty(p)) {
                    continue;
                }
                if (!y.hasOwnProperty(p)) {
                    return false;
                }
                if (x[p] === y[p]) {
                    continue;
                }
                if (typeof(x[p]) !== "object") {
                    return false;
                }
                if (!minDash.isEqual(x[p], y[p])) {
                    return false;
                }
            }
            for (p in y) {
                if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) {
                    return false;
                }
            }
            return true;
        },
        isFunction: function (value) {
            return typeof value === "function" || false;
        },
        isNumber: function (value) {
            return typeof value === "number" && Number.isFinite(value);
        },
        isObject: function (value) {
            return value !== null && typeof value === "object";
        },
        isString: function (value) {
            return value !== null && typeof value === "string";
        },
        map: function (arr, func) {
            return arr.map(func);
        },
        throttle: function (fn, time) {
            var last, deferTimer;
            return function () {
                var now = +new Date();
                var args = arguments;
                if (last && now < last + time) {
                    // hold on to it
                    clearTimeout(deferTimer);
                    deferTimer = setTimeout(function () {
                        last = now;
                        fn.apply(this, args);
                    }, time);
                } else {
                    last = now;
                    fn.apply(this, args);
                }
            };
        },
        extend: function (object, source) {
            var props = Object.keys(source);
            if (!props) {
                props = object;
                object = {};
            }
            var index = -1;
            var length = props.length;
            while (++index < length) {
                var key = props[index];
                object[key] = source[key];
            }
            return object;
        },
    }; /* istanbul ignore if  */
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(function () {
            return factory(minDash, root);
        }); /* istanbul ignore else */
    } else if (typeof module === "object" && module.exports) {
        // Node, or CommonJS-Like environments
        module.exports = factory(minDash, this);
    } else {
        // Browser globals
        root.postal = factory(minDash, root);
    }
}(this, function (_, global, undefined) {
    var prevPostal = global.postal;
    var _defaultConfig = {
        minDash: _,
        DEFAULT_CHANNEL: "/",
        SYSTEM_CHANNEL: "postal",
        enableSystemMessages: true,
        cacheKeyDelimiter: "|",
        autoCompactResolver: false
    };
    var postal = {
        configuration: _.extend({}, _defaultConfig)
    };
    var _config = postal.configuration;
    var ChannelDefinition = function (channelName, bus) {
        this.bus = bus;
        this.channel = channelName || _config.DEFAULT_CHANNEL;
    };
    ChannelDefinition.prototype.subscribe = function () {
        return this.bus.subscribe({
            channel: this.channel,
            topic: (arguments.length === 1 ? arguments[0].topic : arguments[0]),
            callback: (arguments.length === 1 ? arguments[0].callback : arguments[1])
        });
    };
/*
    publish( envelope [, callback ] );
    publish( topic, data [, callback ] );
*/
    ChannelDefinition.prototype.publish = function () {
        var envelope = {};
        var callback;
        if (typeof arguments[0] === "string") {
            envelope.topic = arguments[0];
            envelope.data = arguments[1];
            callback = arguments[2];
        } else {
            envelope = arguments[0];
            callback = arguments[1];
        }
        envelope.channel = this.channel;
        this.bus.publish(envelope, callback);
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
    var ConsecutiveDistinctPredicate = function () {
        var previous;
        return function (data) {
            var eq = false;
            if (_.isString(data)) {
                eq = data === previous;
                previous = data;
            } else {
                eq = _.isEqual(data, previous);
                previous = _.clone(data);
            }
            return !eq;
        };
    };
    var DistinctPredicate = function DistinctPredicateFactory() {
        var previous = [];
        return function DistinctPredicate(data) {
            var isDistinct = !_.any(previous, function (p) {
                if (_.isObject(data) || _.isArray(data)) {
                    return _.isEqual(data, p);
                } else {
                    return data === p;
                }
            });
            if (isDistinct) {
                previous.push(data);
            }
            return isDistinct;
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
            if (!_.isNumber(maxCalls) || maxCalls <= 0) {
                throw new Error("The value provided to disposeAfter (maxCalls) must be a number greater than zero.");
            }
            var self = this;
            var dispose = _.after(maxCalls, _.bind(function () {
                self.unsubscribe();
            }));
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
                var invoked = false;
                if (!len) {
                    self.callback.call(context, data, env);
                    invoked = true;
                } else {
                    pipeline = pipeline.concat([self.callback]);
                    var step = function step(d, e) {
                        idx += 1;
                        if (idx < len) {
                            pipeline[idx].call(context, d, e, step);
                        } else {
                            self.callback.call(context, d, e);
                            invoked = true;
                        }
                    };
                    step(data, env, 0);
                }
                return invoked;
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
                postal.unsubscribe(this);
            }
        },
        constraint: function constraint(predicate) {
            if (!_.isFunction(predicate)) {
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
            if (_.isArray(predicates)) {
                _.each(predicates, function (predicate) {
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
            if (!_.isNumber(milliseconds)) {
                throw new Error("Milliseconds must be a number");
            }
            this.pipeline.push(
            _.debounce(function (data, env, next) {
                next(data, env);
            }, milliseconds, !! immediate));
            return this;
        },
        delay: function delay(milliseconds) {
            if (!_.isNumber(milliseconds)) {
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
            if (!_.isNumber(milliseconds)) {
                throw new Error("Milliseconds must be a number");
            }
            var fn = function (data, env, next) {
                next(data, env);
            };
            this.pipeline.push(_.throttle(fn, milliseconds));
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
    var bindingsResolver = _config.resolver = {
        cache: {},
        regex: {},
        enableCache: true,
        compare: function compare(binding, topic, headerOptions) {
            var pattern;
            var rgx;
            var prevSegment;
            var cacheKey = topic + _config.cacheKeyDelimiter + binding;
            var result = (this.cache[cacheKey]);
            var opt = headerOptions || {};
            var saveToCache = this.enableCache && !opt.resolverNoCache;
            // result is cached?
            if (result === true) {
                return result;
            }
            // plain string matching?
            if (binding.indexOf("#") === -1 && binding.indexOf("*") === -1) {
                result = (topic === binding);
                if (saveToCache) {
                    this.cache[cacheKey] = result;
                }
                return result;
            }
            // ah, regex matching, then
            if (!(rgx = this.regex[binding])) {
                pattern = "^" + _.map(binding.split("."), function mapTopicBinding(segment) {
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
            result = rgx.test(topic);
            if (saveToCache) {
                this.cache[cacheKey] = result;
            }
            return result;
        },
        reset: function reset() {
            this.cache = {};
            this.regex = {};
        },
        purge: function (options) {
            var self = this;
            var keyDelimiter = _config.cacheKeyDelimiter;
            var matchPredicate = function (val, key) {
                var split = key.split(keyDelimiter);
                var topic = split[0];
                var binding = split[1];
                if ((typeof options.topic === "undefined" || options.topic === topic) && (typeof options.binding === "undefined" || options.binding === binding)) {
                    delete self.cache[key];
                }
            };
            var compactPredicate = function (val, key) {
                var split = key.split(keyDelimiter);
                if (postal.getSubscribersFor({
                    topic: split[0]
                }).length === 0) {
                    delete self.cache[key];
                }
            };
            if (typeof options === "undefined") {
                this.reset();
            } else {
                var handler = options.compact === true ? compactPredicate : matchPredicate;
                _.each(this.cache, handler);
            }
        }
    };
    var pubInProgress = 0;
    var unSubQueue = [];
    var autoCompactIndex = 0;
    function clearUnSubQueue() {
        while (unSubQueue.length) {
            postal.unsubscribe(unSubQueue.shift());
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
    function getCacher(topic, cache, cacheKey, done, envelope) {
        var headers = envelope && envelope.headers || {};
        return function (subDef) {
            if (_config.resolver.compare(subDef.topic, topic, headers)) {
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
            channel: _config.SYSTEM_CHANNEL,
            topic: "subscription." + kind,
            data: {
                event: "subscription." + kind,
                channel: subDef.channel,
                topic: subDef.topic
            }
        };
    }
    var sysCreatedMessage = _.bind(getSystemMessage, this, "created");
    var sysRemovedMessage = _.bind(getSystemMessage, this, "removed");
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
                    matched = 0;
                _.each(options, function (val, prop) {
                    compared += 1;
                    if (
                    // We use the bindings resolver to compare the options.topic to subDef.topic
                    (prop === "topic" && resolver.compare(sub.topic, options.topic, {
                        resolverNoCache: true
                    })) || (prop === "context" && options.context === sub._context)
                    // Any other potential prop/value matching outside topic & context...
                    || (sub[prop] === options[prop])) {
                        matched += 1;
                    }
                });
                return compared === matched;
            };
        }
    }
    _.extend(postal, {
        cache: {},
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
            _.each(self.subscriptions, function (channel) {
                _.each(channel, function (subList) {
                    result = result.concat(_.filter(subList, getPredicate(options, _config.resolver)));
                });
            });
            return result;
        },
        publish: function publish(envelope, cb) {
            ++pubInProgress;
            var channel = envelope.channel = envelope.channel || _config.DEFAULT_CHANNEL;
            var topic = envelope.topic;
            envelope.timeStamp = new Date();
            if (this.wireTaps.length) {
                _.each(this.wireTaps, function (tap) {
                    tap(envelope.data, envelope, pubInProgress);
                });
            }
            var cacheKey = channel + _config.cacheKeyDelimiter + topic;
            var cache = this.cache[cacheKey];
            var skipped = 0;
            var activated = 0;
            if (!cache) {
                cache = this.cache[cacheKey] = [];
                var cacherFn = getCacher(
                topic, cache, cacheKey, function (candidate) {
                    if (candidate.invokeSubscriber(envelope.data, envelope)) {
                        activated++;
                    } else {
                        skipped++;
                    }
                }, envelope);
                _.each(this.subscriptions[channel], function (candidates) {
                    _.each(candidates, cacherFn);
                });
            } else {
                _.each(cache, function (subDef) {
                    if (subDef.invokeSubscriber(envelope.data, envelope)) {
                        activated++;
                    } else {
                        skipped++;
                    }
                });
            }
            if (--pubInProgress === 0) {
                clearUnSubQueue();
            }
            if (cb) {
                cb({
                    activated: activated,
                    skipped: skipped
                });
            }
        },
        reset: function reset() {
            this.unsubscribeFor();
            _config.resolver.reset();
            this.subscriptions = {};
        },
        subscribe: function subscribe(options) {
            var subscriptions = this.subscriptions;
            var subDef = new SubscriptionDefinition(options.channel || _config.DEFAULT_CHANNEL, options.topic, options.callback);
            var channel = subscriptions[subDef.channel];
            var channelLen = subDef.channel.length;
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
            _.each(this.cache, function (list, cacheKey) {
                if (cacheKey.substr(0, channelLen) === subDef.channel) {
                    getCacher(
                    cacheKey.split(_config.cacheKeyDelimiter)[1], list, cacheKey)(subDef);
                }
            }); /* istanbul ignore else */
            if (_config.enableSystemMessages) {
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
                    if (topicSubs.length === 0) {
                        delete channelSubs[subDef.topic];
                        if (_.isEmpty(channelSubs)) {
                            delete this.subscriptions[subDef.channel];
                        }
                    }
                    // remove SubscriptionDefinition from postal cache
                    if (subDef.cacheKeys && subDef.cacheKeys.length) {
                        var key;
                        while (key = subDef.cacheKeys.pop()) {
                            _.each(this.cache[key], getCachePurger(subDef, key, this.cache));
                        }
                    }
                    if (typeof _config.resolver.purge === "function") {
                        // check to see if relevant resolver cache entries can be purged
                        var autoCompact = _config.autoCompactResolver === true ? 0 : typeof _config.autoCompactResolver === "number" ? (_config.autoCompactResolver - 1) : false;
                        if (autoCompact >= 0 && autoCompactIndex === autoCompact) {
                            _config.resolver.purge({
                                compact: true
                            });
                            autoCompactIndex = 0;
                        } else if (autoCompact >= 0 && autoCompactIndex < autoCompact) {
                            autoCompactIndex += 1;
                        }
                    }
                }
                if (_config.enableSystemMessages) {
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
    });
    if (global && Object.prototype.hasOwnProperty.call(global, "__postalReady__") && _.isArray(global.__postalReady__)) {
        while (global.__postalReady__.length) {
            global.__postalReady__.shift().onReady(postal);
        }
    }
    return postal;
}));