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