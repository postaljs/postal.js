# Postal.js

## What is it?
Postal.js is a JavaScript pub/sub library that can be used in the browser, or on the server-side using Node.js. It extends the "eventing" paradigm most JavaScript developers are already familiar with by providing an in-memory message bus to which your code/components/modules/etc can subscribe & publish.

## Why would I use it?
If you are looking to decouple the various components/libraries/plugins you use (client-or-server-side), applying messaging can enable you to not only easily separate concerns, but also enable you to more painlessly plug in additional components/functionality in the future.  A pub/sub library like Postal.js can assist you in picking & choosing the libraries that best address the problems you're trying to solve, without burdening you with the requirement that those libraries have to be natively interoperable.  For example:

* If you're using a client-side binding framework, and either don't have - or don't like - the request/communication abstractions provided, then grab a library like [amplify.js](http://amplifyjs.com) or [reqwest](https://github.com/ded/reqwest).  Then, instead of tightly coupling the two, have the request success/error callbacks publish messages with the appropriate data and any subscribers you've wired up can handle applying the data to the specific objects/elements they're concerned with.
* Do you need two view models to communicate, but you don't want them to need to know about each other?  Have them subscribe to the topics about which they are interested in receiving messages.  From there, whenever a view model needs to alert any listeners of specific data/events, just publish a message to the bus.  If the other view model is present, it will receive the notification.
* Want to wire up your own binding framework?  Want to control the number of times subscription callbacks get invoked within a given time frame? Want to keep subscriptions from being fired until after data stops arriving? Want to keep events from being acted upon until the UI event loop is done processing other events?  These - and more - are all things Postal can do for you.

## Wut?  Another pub/sub library?
Why, yes.  There are great alternatives to Postal.  If you need something leaner for client-side development, look at amplify.js.  If you're in Node.js and can get by with EventEmitter, great.  However, I discovered that as my needs quickly grew, I wanted something that was as lean as possible, without sacrificing some of the more complex functionality that's not provided by libraries like amplify.js, and the EventEmitter object in Node.

## How do I use it?
In a nutshell, Postal provides an in-memory message bus, where clients subscribe to a topic (which can include wildcards, as we'll see), and publishers publish messages (passing a topic along with it).  Postal's "bindingResolver" handles matching a published message's topic to subscribers who should be notified of the message.  When a client subscribes, they pass a callback that should be invoked whenever a message comes through.  This callback takes one argument - the "data" payload of the message.  (Messages do not *have* to include data - they can simply be used to indicate an event, and not transmit additional state).  Additional options/constraints can be set on a subscription (see examples below, and check out the fluent calls available on the SubscriptionDefinition prototype).

Here are four examples of using Postal.  All of these examples - AND MORE! - can be run live here: [http://jsfiddle.net/ifandelse/NTPcT/](http://jsfiddle.net/ifandelse/NTPcT/)

JavaScript:

```javascript
// The world's simplest subscription
var channel = postal.channel("Name.Changed");

// subscribe
var subscription = channel.subscribe(function(data) { $("#example1").html("Name: " + data.name); });

// And someone publishes a first name change:
channel.publish({ name: "Dr. Who" });
subscription.unsubscribe();
```

### Subscribing to a wildcard topic using #

The `#` symbol represents "one word" in a topic (i.e - the text between two periods of a topic). By subscribing to `"#.Changed"`, the binding will match `Name.Changed` & `Location.Changed` but *not* for `Changed.Companion`

```javascript
var hashChannel = postal.channel("#.Changed"),
    chgSubscription = hashChannel.subscribe(function(data) {
        $('<li>' + data.type + " Changed: " + data.value + '</li>').appendTo("#example2");
    });
postal.channel("Name.Changed")
      .publish({ type: "Name", value:"John Smith" });
postal.channel("Location.Changed")
      .publish({ type: "Location", value: "Early 20th Century England" });
chgSubscription.unsubscribe();
```

### Subscribing to a wildcard topic using *

The `*` symbol represents any number of characters/words in a topic string. By subscribing to ``"DrWho.*.Changed"``, the binding will match `DrWho.NinthDoctor.Companion.Changed` & `DrWho.Location.Changed` but *not* `Changed`

```javascript
var starChannel = postal.channel("DrWho.*.Changed"),
    starSubscription = starChannel.subscribe(function(data) {
        $('<li>' + data.type + " Changed: " + data.value + '</li>').appendTo("#example3");
    });
postal.channel("DrWho.NinthDoctor.Companion.Changed")
      .publish({ type: "Name", value:"Rose" });
postal.channel("DrWho.TenthDoctor.Companion.Changed")
      .publish({ type: "Name", value:"Martha" });
postal.channel("DrWho.Eleventh.Companion.Changed")
      .publish({ type: "Name", value:"Amy" });
postal.channel("DrWho.Location.Changed")
      .publish({ type: "Location", value: "The Library" });
postal.channel("TheMaster.DrumBeat.Changed")
      .publish({ type: "DrumBeat", value: "This won't trigger any subscriptions" });
postal.channel("Changed")
      .publish({ type: "Useless", value: "This won't trigger any subscriptions either" });
starSubscription.unsubscribe();
```

### Applying ignoreDuplicates to a subscription

```javascript
var dupChannel = postal.channel("WeepingAngel.*"),
    dupSubscription = dupChannel.subscribe(function(data) {
                          $('<li>' + data.value + '</li>').appendTo("#example4");
                      }).ignoreDuplicates();
postal.channel("WeepingAngel.DontBlink")
      .publish({ value:"Don't Blink" });
postal.channel("WeepingAngel.DontBlink")
      .publish({ value:"Don't Blink" });
postal.channel("WeepingAngel.DontEvenBlink")
      .publish({ value:"Don't Even Blink" });
postal.channel("WeepingAngel.DontBlink")
      .publish({ value:"Don't Close Your Eyes" });
dupSubscription.unsubscribe();
```

## How can I extend it?
There are two main ways you can extend Postal:

* First, you can write an entirely new bus implementation (want to tie into a real broker like RabbitMQ by hitting the [experimental] JSON RPC endpoints and wrap it with Postal's API?  This is how you'd do it.).  If you want to do this, look over the `localBus` implementation to see how the core version works.  Then, you can simply swap the bus implementation out by calling: `postal.configuration.bus = myWayBetterBusImplementation`.
* The second way you can extend Postal is to change how the `bindingResolver` works.  You may not care for the RabbitMQ-style bindings functionality.  No problem!  Write your own resolver object that implements a `compare` method and swap the core version out with your implementation by calling: `postal.configuration.resolver = myWayBetterResolver`.

It's also possible to extend the monitoring of messages passing through Postal by adding a "wire tap".  A wire tap is a callback that will get invoked for any published message (even if no actual subscriptions would bind to the message's topic).  Wire taps should _not_ be used in lieu of an actual subscription - but instead should be used for diagnostics, logging, forwarding (to a websocket publisher, for example) or other concerns that fall along those lines.

## Can I contribute?
Please - by all means!  While I hope the API is relatively stable, I'm open to pull requests.  (Hint - if you want a feature implemented, a pull request gives it a much higher probability of being included than simply asking me.)  As I said, pull requests are most certainly welcome - but please include tests for your additions.  Otherwise, it will disappear into the ether.

## Roadmap for the Future
Here's where Postal is headed:

* The original proof-of-concept version of postal supported the ability to capture messages and replay them.  This functionality will be added soon.
* The ability to 'join' two (or more) subscriptions, so that the original subscription will only fire once the second "joined" subscription has also fired.  Think of it as a message-based version of a compound promise.
* I haven't yet thoroughly tested Postal on Node.js - that is high on my list as well.
* What else would you like to see?