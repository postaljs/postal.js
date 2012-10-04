# Postal.js

## Version 0.7.3 (Dual Licensed [MIT](http://www.opensource.org/licenses/mit-license) & [GPL](http://www.opensource.org/licenses/gpl-license))

## What is it?
Postal.js is an in-memory message bus - very loosely inspired by [AMQP](http://www.amqp.org/) - written in JavaScript.  Postal.js runs in the browser, or on the server-side using Node.js. It takes a familiar "eventing-style" paradigm most JavaScript developers are already used to and extends it by providing "broker" and subscriber implementations which are more sophisticated than what you typically find in simple event delegation.

## Why would I use it?
Using a local message bus can enable to you de-couple your web application's components in a way not possible with other 'eventing' approaches.  In addition, strategically adopting messaging at the 'seams' of your application (e.g. - between modules, at entry/exit points for browser data and storage) can not only help enforce better overall architectural design, but also insulate you from the risks of tightly coupling your application to 3rd party libraries.  For example:

* If you're using a client-side binding framework, and either don't have - or don't like - the request/communication abstractions provided, then grab a library like [amplify.js](http://amplifyjs.com) or [reqwest](https://github.com/ded/reqwest).  Then, instead of tightly coupling the two, have the request success/error callbacks publish messages with the appropriate data and any subscribers you've wired up can handle applying the data to the specific objects/elements they're concerned with.
* Do you need two view models to communicate, but you don't want them to need to know about each other?  Have them subscribe to the topics about which they are interested in receiving messages.  From there, whenever a view model needs to alert any listeners of specific data/events, just publish a message to the bus.  If the other view model is present, it will receive the notification.
* Want to wire up your own binding framework?  Want to control the number of times subscription callbacks get invoked within a given time frame? Want to keep subscriptions from being fired until after data stops arriving? Want to keep events from being acted upon until the UI event loop is done processing other events?  Postal.js gives you the control you need in these kinds of scenarios via the options available on the `SubscriptionDefinition` object.
* postal.js is extensible.  Custom channels can be added - for example - to allow postal to communicate with other postal.js instances over websockets.  Plugins like [postal.when](https://github.com/ifandelse/postal.when) can be included to provide even more targeted functionality to subscribers.  These - and more - are all things Postal can do for you.

## Philosophy
Postal.js is in good company - there are many options for &lt;airquotes&gt;pub/sub&lt;/airquotes&gt; in the browser.  However, I grew frustrated with most of them because they often closely followed an event-delegation-paradigm, instead of providing a structured in-memory message bus.  Central to postal.js are three concepts:

* channels should be provided to allow for logical partitioning of "topics"
* topcis should be hierarchical and allow plain string or wildcard bindings
* messages should include envelope metadata

## Recent Updates (IMPORTANT)

Version 0.7.3 of postal has implemented a bindings resolver that aligns with how AMQP handles wildcards in topical bindings.  ***Please note that this effectively inverts how postal has handled wildcards up to now***.  You can still use the old version of the bindings resolve by including the `classic-resolver.js` file in your project. If you want to use the new resolver, just use postal as-is and know that "#" matches 0 or more "words" (words are period-delimited segments of topics) and "*" matches exactly one word.

### Channels? WAT?
A channel is a logical partition of topics.  Conceptually, it's like a dedicated highway for a specific set of communication.  At first glance it might seem like that's overkill for an environment that runs in an event loop, but it actually proves to be quite useful.  Every library has architectural opinions that it either imposes or nudges you toward.  Channel-oriented messaging nudges you to separate your communication by bounded context, and enables the kind of fine-tuned visibility you need into the interactions between components as your application grows.

### Hierarchical Topics
In my experience, seeing publish and subscribe calls all over application logic is usually a strong code smell.  Ideally, the majority of message-bus integration should be concealed within application infrastructure.  Having a hierarchical-wildcard-bindable topic system makes it very easy to keep things concise (especially subscribe calls!).  For example, if you have a module that needs to listen to every message published on the ShoppingCart channel, you'd simply subscribe to "\#", and never have to worry about additional subscribes on that channel again - even if you add new messages in the future.  If you need to capture all messages with ".validation" at the end of the topic, you'd simply subscribe to "\#.validation".  If you needed to target all messages with topics that started with "Customer.", ended with ".validation" and had only one period-delimited segment in between, you'd subscribe to "Customer.*.validation" (thus your subscription would capture Customer.address.validation and Customer.email.validation").

## How do I use it?

Here are four examples of using Postal.  All of these examples - AND MORE! - can run live here: [http://jsfiddle.net/ifandelse/FdFM3/](http://jsfiddle.net/ifandelse/FdFM3/) (Please bear in mind this fiddle is pulling the postal lib from github, so running these in IE will not work due to the mime type mismatch.)

JavaScript:

```javascript
// The world's simplest subscription
// doesn't specify a channel name, so it defaults to "/" (DEFAULT_CHANNEL)
var channel = postal.channel( { topic: "Name.Changed" } );

// this call is identical to the one above
var channel = postal.channel( "Name.Changed" )

// To specify a channel name you can do one of the following
var channel = postal.channel( { channel: "MyChannel", topic: "MyTopic" } );
var channel = postal.channel( "MyChannel","MyTopic" );


// subscribe
var subscription = channel.subscribe( function( data, envelope ) {
	$( "#example1" ).html( "Name: " + data.name );
});

// And someone publishes a first name change:
channel.publish( { name: "Dr. Who" } );
subscription.unsubscribe();
```

### Subscribing to a wildcard topic using *

The `*` symbol represents "one word" in a topic (i.e - the text between two periods of a topic). By subscribing to `"*.Changed"`, the binding will match `Name.Changed` & `Location.Changed` but *not* `Changed.Companion`.

```javascript
var hashChannel = postal.channel( { topic: "*.Changed" } ),
    chgSubscription = hashChannel.subscribe( function( data ) {
        $( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example2" );
    });
postal.channel( { topic: "Name.Changed" } )
      .publish( { type: "Name", value:"John Smith" } );
postal.channel( "Location.Changed" )
      .publish( { type: "Location", value: "Early 20th Century England" } );
chgSubscription.unsubscribe();
```

### Subscribing to a wildcard topic using &#35;

The `#` symbol represents any number of characters/words in a topic string. By subscribing to ``"DrWho.#.Changed"``, the binding will match `DrWho.NinthDoctor.Companion.Changed` & `DrWho.Location.Changed` but *not* `Changed`.

```javascript
var starChannel = postal.channel( { channel: "Doctor.Who", topic: "DrWho.#.Changed" } ),
    starSubscription = starChannel.subscribe( function( data ) {
        $( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example3" );
    });
/*
  Demonstrating how we're re-using the channel declared above to publish, but overriding the topic
  in the second argument.  Note to override the topic, you have to use the "envelope" structure,
  which means an object like:

  { channel: "myChannel", topic: "myTopic", data: { someProp: "SomeVal, moarData: "MoarValue" } };

  The only thing to note is that since we are publishing from a channel definition, you don't need
  to pass "channel" (in fact, it would be ignored)
*/
starChannel.publish( { topic: "DrWho.NinthDoctor.Companion.Changed", data: { type: "Name", value:"Rose"   } } );
starChannel.publish( { topic: "DrWho.TenthDoctor.Companion.Changed", data: { type: "Name", value:"Martha" } } );
starChannel.publish( { topic: "DrWho.Eleventh.Companion.Changed",    data: { type: "Name", value:"Amy"    } } );
starChannel.publish( { topic: "DrWho.Location.Changed",              data: { type: "Location", value: "The Library" } } );
starChannel.publish( { topic: "TheMaster.DrumBeat.Changed",          data: { type: "DrumBeat", value: "This won't trigger any subscriptions" } } );
starChannel.publish( { topic: "Changed",                             data: { type: "Useless", value: "This won't trigger any subscriptions either" } } );

starSubscription.unsubscribe();
```



### Applying distinctUntilChanged to a subscription

```javascript
var dupChannel = postal.channel( { topic: "WeepingAngel.#" } ),
    dupSubscription = dupChannel.subscribe( function( data ) {
                          $( '<li>' + data.value + '</li>' ).appendTo( "#example4" );
                      }).distinctUntilChanged();
// demonstrating multiple channels per topic being used
// You can do it this way if you like, but the example above has nicer syntax (and *much* less overhead)
postal.channel( { topic: "WeepingAngel.DontBlink" } )
      .publish( { value:"Don't Blink" } );
postal.channel( { topic: "WeepingAngel.DontBlink" } )
      .publish( { value:"Don't Blink" } );
postal.channel( { topic: "WeepingAngel.DontEvenBlink" } )
      .publish( { value:"Don't Even Blink" } );
postal.channel( { topic: "WeepingAngel.DontBlink" } )
      .publish( { value:"Don't Close Your Eyes" } );
postal.channel( { topic: "WeepingAngel.DontBlink" } )
      .publish( { value:"Don't Blink" } );
postal.channel( { topic: "WeepingAngel.DontBlink" } )
      .publish( { value:"Don't Blink" } );
dupSubscription.unsubscribe();
```

## More References
Please visit the [postal.js wiki](https://github.com/ifandelse/postal.js/wiki) for API documentation, discussion of concepts and links to blogs/articles on postal.js.

## How can I extend it?
There are four main ways you can extend Postal:

* Write a plugin.  Need more complex behavior that the built-in SubscriptionDefinition doesn't offer?  Write a plugin that you can attach to the global postal object.  See [postal.when](https://github.com/ifandelse/postal.when) for an example of how to do this.
* Write a custom channel implementation for postal. The `postal.channelTypes` namespace can contain as many channel types as you wish.  See the [postal.socket](https://github.com/ifandelse/postal.socket) proof-of-concept plugin for an example of a custom channel that could be applicable in both the browser and node.js (a full production worthy version of this plugin is already in the works).  Other custom channels specific to environments like node.js could be considered as well (ex - a bridge to redis pub/sub, AMQP/RabbitMQ, etc.).
* You can write an entirely new bus implementation if you wanted.  The postal `subscribe`, `publish` and `addWiretap` calls all simply wrap a concrete implementation provided by the `postal.configuration.bus` object.  For example, if you wanted a bus that stored message history in local storage and pushed a dump of past messages to a new subscriber, you'd simply write your implementation and then swap the default one out by calling: `postal.configuration.bus = myWayBetterBusImplementation`.
* You can also change how the `bindingResolver` matches subscriptions to message topics being published.  You may not care for the inverted RabbitMQ-style bindings functionality (postal currently inverts the treatment of asterisk and hash wildcard symbols compared to AMQP).  No problem!  Write your own resolver object that implements a `compare` and `reset` method and swap the core version out with your implementation by calling: `postal.configuration.resolver = myWayBetterResolver`.

It's also possible to extend the monitoring of messages passing through Postal by adding a "wire tap".  A wire tap is a callback that will get invoked for any published message (even if no actual subscriptions would bind to the message's topic).  Wire taps should _not_ be used in lieu of an actual subscription - but instead should be used for diagnostics, logging, forwarding (to a websocket publisher or a local storage wrapper, for example) or other concerns that fall along those lines.  This repository used to include a console logging wiretap called postal.diagnostics.js - you can now find it [here in it's own repo](https://github.com/ifandelse/postal.diagnostics).  This diagnostics wiretap can be configured with filters to limit the firehose of message data to specific channels/topics and more.

## Can I contribute?
Please - by all means!  While I hope the API is relatively stable, I'm open to pull requests.  (Hint - if you want a feature implemented, a pull request gives it a much higher probability of being included than simply asking me.)  As I said, pull requests are most certainly welcome - but please include tests for your additions.  Otherwise, it will disappear into the ether.

## Roadmap for the Future
Here's where Postal is headed:

* Add-ons to enable message capture and replay are in the works and should be ready soon.
* The `SubscriptionDefinition` object will be given the ability to pause (skip) responding to subscriptions
* What else would you like to see?