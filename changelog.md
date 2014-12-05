##v0.11.2
* Two ES5 `.bind` calls snuck in - we're not officially on ES5 syntax yet (but will be soon). Converting those to use lodash's `_.bind` call for now.

##v0.11.1
* Fixing an npm publishing goof, which requires a version bump. :-(

##v0.11.0
* ConduitJS is no longer a dependency.
* `invokeSubscriber` has been added to the `SubscriptionDefinition` prototype. This method is called during publish cycles. The `postal.publish` method no longer does the heavy lifting of determining if a subscriber callback should be invoked, the subscriber now handles that via this new method.
* The `SubscriptionDefinition` prototype methods `withContext`, `withThrottle`, `withDebounce`, `withDelay`, `withConstraint`, `withConstraints` have been deprecated and replaced with `context`, `throttle`, `debounce`, `delay`, `constraint` and `constraints` (respectively). They will continue to work in v0.11, but will warn of the deprecation.
* postal has been optimized for publishing (subscriptions matched to a topic via the resolver are cached).

##v0.10.3
* Wiretaps now get a third argument, the `nesting` (or `publishDepth`) argument, which is a number to indicate the 'nested' publish depth for the message being passed to the wiretap. Thanks to @avanderhoorn for this addition. :smile:

##v0.10.2
* Empty topic subscriptions arrays (on `postal.subscriptions.whateverChannel`) will be removed during unsubscription if the subscriber being removed is the last subscriber.
* Empty channel objects (on `postal.susbcriptions`) will be removed during unsubscription if no topic binding properties exist on the channel any longer.
* Special thanks to @sergiopereiraTT for adding these features. :smile:

##v0.10.1
* Apparently IE 8 doesn't allow "catch" to be used as a method/prop name, unless you utilize bracket notation. (Seriously - With IE6 now a distant memory, I long for the day that IE 8 is *dead*.) @swaff was kind enough to catch this and submit a patch to take care of it.

##v0.10.0

* (Breaking) Removed the "basic" build of postal. The conclusion was the best (and least confusing) option was to focus on a customized build of lodash - rather than risk fragmentation of postal's features...
* Added `logError` and `catch` to the `SubscriptionDefinition` courtesy of @arobson.

##v0.9.1

* Replaced underscore dependency with lodash. (You can still use underscore if you need to - but you'll have to replace the lib's references to "lodash" with "underscore")
* [ConduitJS](https://github.com/ifandelse/ConduitJS) has been an *embedded* dependency since v0.9.0. I've promoted it to an external dependency because it's clear that Conduit will be useful in add-ons as well. No need to force consumers of postal and its add-ons to double the Conduit line count.

##v0.9.0

* Merged `localBus` with `postal` namespace. Postal originally supported the idea of swappable bus implementations. This gold plating has been ripped out finally.
* Added a `noConflict` method to allow for side by side instances of different postal versions (for testing/benchmarking).
* Refactored `SubscriptionDefinition` significantly to allow for [ConduitJS](https://github.com/ifandelse/ConduitJS) integration into the subscription callback method as well as the `ChannelDefinition` publish method.
* Top-level `postal.unsubscribe` call has been added.
* Top-level `postal.unsubscribeFor` call has been added.

###Breaking Changes

* Removed `postal.utils` namespace. Any methods under `utils` are now under `postal` itself.
* Changed signature of getSubscribersFor to take either an options object or a predicate function.
* The CommonJS wrapper *no longer provides a factory function* that has to be invoked. Instead it now simply exports postal itself.
* Subscriptions are now stored under `postal.subscriptions`.
* postal now produces two different builds: a full and minimal build. The minimal build lacks ConduitJS as an embedded dependency, and the only `SubscriptionDefinition` prototype methods in the minimal build are `subscribe`, `unsubscribe`, and `withContext`. The minimal build is relevant if you do not need to additional features (like `defer`, `withDebounce`, etc.) and lib size is a concern.
* `postal.publish` and `ChannelDefinition.prototype.publish` no longer return the envelope.
