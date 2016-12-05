# v2.x

## v2.0.5
* Fixed caching when resolverNoCache is set to true
* Allowed resolverNoCache config option to be passed to envelope headers

## v2.0.4
* Conditionally calling _.noConflict (only if previous global._ was truthy and not equal to postal's lodash version)

## v2.0.3
* Fixed lodash isEqual file name casing.

## v2.0.2
* Thanks to @jcreamer898:
	* Fixed lodash paths, removed unnecesary `_.noConflict()` call.
	* Added travis.yml.

## v2.0.1
* Added call to lodash's noConflict.

## v2.0.0
* Merged #151 (breaking change, requires [function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind) polyfill in older browsers)
* Removed deprecated SubscriptionDefinition methods (breaking change)
    * Removed method names: `withConstraint`, `withConstraints`, `withContext`, `withDebounce`, `withDelay`, `withThrottle`
	* Correct/current method names: `constraint`, `constraints`, `context`, `debounce`, `delay`, `throttle`

# v1.x

## v1.0.11
* Fixed even more issues I missed with lodash 4
* Made note-to-self to be extra careful cutting new tags while sick.

## v1.0.10
* Fixed issue where removed lodash alias was still in use
* Fixed issue `this` context issue in postal.subscribe

## v1.0.9
* Merged #148 - Updated to lodash 4.x
* Merged #128 - Remove unused bower.json version prop

## v1.0.8
* Fixed #136, where `global` was undefined when setting `prevPostal` for noConflict situations.

## v1.0.7

* Included @derickbailey's awesome logo addition!
* Updated gulp build setup to run formatting on src and lib.
* Added a `throw` when `ChannelDefinition.prototype.publish` is not passed a valid first argument.

## v1.0.6

* Fixed issue where JSCS's formatting fix put a line break before `catch` on the `SubscriptionDefinition` prototype.
* Added additional comment directive removal (covering jshint, jscs & istanbul).

## v1.0.5

* Fixed issue (referred to in #124) related to the custom lodash build not pulling in necessary behavior for _.each.
* Added deprecation warnings to istanbul ignore.

## v1.0.4

* Fixed issue where a subscriber lookup cache (postal's internal cache) was failing to update when new subscribers were added after a publish matching the cache had occurred.

## v1.0.3

* Fixed memory leak issue referred to [here](https://github.com/postaljs/postal.js/issues/95#issuecomment-99336472). Postal will not place subscriptions in the lookup cache if the `resolverNoCache` header is present on the published envelope.

## v1.0.2

* Updated lodash dependency to 3.x.

## v1.0.0
* 3.5 years in the making, 1.0 finally arrives! :-)
* Updated lodash dependency to ~3.1.0
* Customized lodash build option added (`lib/postal.lodash.js`) - containing only the lodash bits needed for postal (special thanks to @jdalton for making that happen!).
* Updated gulpfile to produce standard and custom-lodash builds.
* Updated package.json scripts to allow for testing both standard and lodash builds
* Added an `.editorconfig` file to normalize indentation and whitespace concerns.

# v0.x

## v0.12.4
* Added support for publish metadata callback (thanks @arobson).
* Removing minified output from bower.json's `main` array (thanks @iam-merlin).

## v0.12.3
* Merged in @efurmantt's PR to support toggling resolver cache on and off.

## v0.12.2
* Fixed bug with `resolverNoCache` option where matches would fail if caching was disabled.

## v0.12.1
* Added support for an envelope header value called `resolverNoCache`. If present in `enveloper.headers` and set to true, it will prevent the resolver from caching topic/binding matches for that message instance.

## v0.12.0
* Added the `purge` method to the default bindings resolver
* Added the `autoCompactResolver` option to `postal.configuration` - it can be set to `true` (which auto-compacts the resolver cache on *every* unsubscribe, `false` (the default) which never automatically compacts the resolver cache or set to an integer > 0, which will auto-compact the resolver cache ever *n* number of unsubscribes (so setting it to 5 will auto-compact every 5th unsubscribe). "Auto compacting" basically purges any resolver comparison results that do not have subscribers active on those topics (i.e. - nothing it listening to those topics, don't keep the cached comparison results any more).
* Added the `cacheKeyDelimiter` option to `postal.configuration`, which defaults to the pipe (`|`) symbol. This is primarily to give anyone implementing their own resolver a different way to delimit topics and bindings when they're using to compose a resolver cache key.
* Added a third argument to the `resolver.compare` method, which allows you to pass an options object to take into consideration while performing the comparison between topic and binding. Currently, the only supported option is `preventCache` - which tells the resolver to not cache the result of the comparison.

## v0.11.2
* Two ES5 `.bind` calls snuck in - we're not officially on ES5 syntax yet (but will be soon). Converting those to use lodash's `_.bind` call for now.

## v0.11.1
* Fixing an npm publishing goof, which requires a version bump. :-(

## v0.11.0
* ConduitJS is no longer a dependency.
* `invokeSubscriber` has been added to the `SubscriptionDefinition` prototype. This method is called during publish cycles. The `postal.publish` method no longer does the heavy lifting of determining if a subscriber callback should be invoked, the subscriber now handles that via this new method.
* The `SubscriptionDefinition` prototype methods `withContext`, `withThrottle`, `withDebounce`, `withDelay`, `withConstraint`, `withConstraints` have been deprecated and replaced with `context`, `throttle`, `debounce`, `delay`, `constraint` and `constraints` (respectively). They will continue to work in v0.11, but will warn of the deprecation.
* postal has been optimized for publishing (subscriptions matched to a topic via the resolver are cached).

## v0.10.3
* Wiretaps now get a third argument, the `nesting` (or `publishDepth`) argument, which is a number to indicate the 'nested' publish depth for the message being passed to the wiretap. Thanks to @avanderhoorn for this addition. :smile:

## v0.10.2
* Empty topic subscriptions arrays (on `postal.subscriptions.whateverChannel`) will be removed during unsubscription if the subscriber being removed is the last subscriber.
* Empty channel objects (on `postal.susbcriptions`) will be removed during unsubscription if no topic binding properties exist on the channel any longer.
* Special thanks to @sergiopereiraTT for adding these features. :smile:

## v0.10.1
* Apparently IE 8 doesn't allow "catch" to be used as a method/prop name, unless you utilize bracket notation. (Seriously - With IE6 now a distant memory, I long for the day that IE 8 is *dead*.) @swaff was kind enough to catch this and submit a patch to take care of it.

## v0.10.0

* (Breaking) Removed the "basic" build of postal. The conclusion was the best (and least confusing) option was to focus on a customized build of lodash - rather than risk fragmentation of postal's features...
* Added `logError` and `catch` to the `SubscriptionDefinition` courtesy of @arobson.

## v0.9.1

* Replaced underscore dependency with lodash. (You can still use underscore if you need to - but you'll have to replace the lib's references to "lodash" with "underscore")
* [ConduitJS](https://github.com/ifandelse/ConduitJS) has been an *embedded* dependency since v0.9.0. I've promoted it to an external dependency because it's clear that Conduit will be useful in add-ons as well. No need to force consumers of postal and its add-ons to double the Conduit line count.

## v0.9.0

* Merged `localBus` with `postal` namespace. Postal originally supported the idea of swappable bus implementations. This gold plating has been ripped out finally.
* Added a `noConflict` method to allow for side by side instances of different postal versions (for testing/benchmarking).
* Refactored `SubscriptionDefinition` significantly to allow for [ConduitJS](https://github.com/ifandelse/ConduitJS) integration into the subscription callback method as well as the `ChannelDefinition` publish method.
* Top-level `postal.unsubscribe` call has been added.
* Top-level `postal.unsubscribeFor` call has been added.

### Breaking Changes

* Removed `postal.utils` namespace. Any methods under `utils` are now under `postal` itself.
* Changed signature of getSubscribersFor to take either an options object or a predicate function.
* The CommonJS wrapper *no longer provides a factory function* that has to be invoked. Instead it now simply exports postal itself.
* Subscriptions are now stored under `postal.subscriptions`.
* postal now produces two different builds: a full and minimal build. The minimal build lacks ConduitJS as an embedded dependency, and the only `SubscriptionDefinition` prototype methods in the minimal build are `subscribe`, `unsubscribe`, and `withContext`. The minimal build is relevant if you do not need to additional features (like `defer`, `withDebounce`, etc.) and lib size is a concern.
* `postal.publish` and `ChannelDefinition.prototype.publish` no longer return the envelope.
