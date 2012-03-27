# Postal.js

## Version 0.6.0 Release Candidate

## What is it?
Postal.js is a JavaScript pub/sub library that can be used in the browser, or on the server-side using Node.js. It extends the "eventing-style" paradigm most JavaScript developers are already familiar with by providing an in-memory message bus to which your code/components/modules/etc can subscribe & publish.

## Why would I use it?
If you are looking to decouple the various components/libraries/plugins you use (client-or-server-side), applying messaging can enable you to not only easily separate concerns, but also enable you to more painlessly plug in additional components/functionality in the future.  A pub/sub library like postal.js can assist you in picking & choosing the libraries that best address the problems you're trying to solve, without burdening you with the requirement that those libraries have to be natively interoperable.  For example:

* If you're using a client-side binding framework, and either don't have - or don't like - the request/communication abstractions provided, then grab a library like [amplify.js](http://amplifyjs.com) or [reqwest](https://github.com/ded/reqwest).  Then, instead of tightly coupling the two, have the request success/error callbacks publish messages with the appropriate data and any subscribers you've wired up can handle applying the data to the specific objects/elements they're concerned with.
* Do you need two view models to communicate, but you don't want them to need to know about each other?  Have them subscribe to the topics about which they are interested in receiving messages.  From there, whenever a view model needs to alert any listeners of specific data/events, just publish a message to the bus.  If the other view model is present, it will receive the notification.
* Want to wire up your own binding framework?  Want to control the number of times subscription callbacks get invoked within a given time frame? Want to keep subscriptions from being fired until after data stops arriving? Want to keep events from being acted upon until the UI event loop is done processing other events?  These - and more - are all things Postal can do for you.

## Philosophy
Postal.js is in good company - there are many options for pub/sub in the browser.  However, I grew frustrated with most of them because they often closely followed a DOM-eventing-paradigm, instead of providing a more substantial in-memory message bus.  Central to postal.js are two things:

* channels
* hierarchical topics (which allow plan string or wildcard bindings)

### Channels? WAT?
A channel is a logical partition of topics.  Conceptually, it's like a dedicated highway for a specific set of communication.  At first glance it might seem like that's overkill for an environment that runs in an event loop, but it actually proves to be quite useful.  Every library has architectural opinions that it either imposes or nudges you toward.  Channel-oriented messaging nudges you to separate your communication by bounded context, and enables the kind of fine-tuned visibility you need into the interactions between components as your application grows.

### Hierarchical Topics
In my experience, seeing publish and subscribe calls all over application logic is usually strong code smell.  Ideally, the majority of message-bus integration should be concealed within app infrastructure.  Having a hierarchical-wildcard-bindable topic system makes it very easy to keep things concise (especially subscribe calls!).  For example, if you have a module that needs to listen to ever message published on the ShoppingCart channel, you'd simply subscribe to "*", and never have to worry about additional subscribes on that channel again - even if you add new messages in the future.  If you need to capture all messages with ".validation" at the end of the topic, you'd simply subscribe to "*.validation".

## How do I use it?

Here are four examples of using Postal.  All of these examples - AND MORE! - can be run live here: [http://jsfiddle.net/ifandelse/FdFM3/](http://jsfiddle.net/ifandelse/FdFM3/)

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

### Subscribing to a wildcard topic using #

The `#` symbol represents "one word" in a topic (i.e - the text between two periods of a topic). By subscribing to `"#.Changed"`, the binding will match `Name.Changed` & `Location.Changed` but *not* for `Changed.Companion`

```javascript
var hashChannel = postal.channel( { topic: "#.Changed" } ),
    chgSubscription = hashChannel.subscribe( function( data ) {
        $( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example2" );
    });
postal.channel( { topic: "Name.Changed" } )
      .publish( { type: "Name", value:"John Smith" } );
postal.channel( "Location.Changed" )
      .publish( { type: "Location", value: "Early 20th Century England" } );
chgSubscription.unsubscribe();
```

### Subscribing to a wildcard topic using *

The `*` symbol represents any number of characters/words in a topic string. By subscribing to ``"DrWho.*.Changed"``, the binding will match `DrWho.NinthDoctor.Companion.Changed` & `DrWho.Location.Changed` but *not* `Changed`

```javascript
var starChannel = postal.channel( { channel: "Doctor.Who", topic: "DrWho.*.Changed" } ),
    starSubscription = starChannel.subscribe( function( data ) {
        $( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example3" );
    });
/*
  Demonstrating how we're re-using the channel delcared above to publish, but overriding the topic
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

### Applying ignoreDuplicates to a subscription

```javascript
var dupChannel = postal.channel( { topic: "WeepingAngel.*" } ),
    dupSubscription = dupChannel.subscribe( function( data ) {
                          $( '<li>' + data.value + '</li>' ).appendTo( "#example4" );
                      }).ignoreDuplicates();
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
dupSubscription.unsubscribe();
```

## How can I extend it?
There are three main ways you can extend Postal:

* Write a plugin.  Need more complex behavior that the built-in SubscriptionDefinition doesn't offer?  Write a plugin that you can attach to the global postal object.  See [postal.when]() for an example of how to do this.
* First, you can write an entirely new bus implementation (want to tie into a real broker like RabbitMQ by hitting the [experimental] JSON RPC endpoints and wrap it with Postal's API?  This is how you'd do it.).  If you want to do this, look over the `localBus` implementation to see how the core version works.  Then, you can simply swap the bus implementation out by calling: `postal.configuration.bus = myWayBetterBusImplementation`.
* The second way you can extend Postal is to change how the `bindingResolver` works.  You may not care for the RabbitMQ-style bindings functionality.  No problem!  Write your own resolver object that implements a `compare` method and swap the core version out with your implementation by calling: `postal.configuration.resolver = myWayBetterResolver`.

It's also possible to extend the monitoring of messages passing through Postal by adding a "wire tap".  A wire tap is a callback that will get invoked for any published message (even if no actual subscriptions would bind to the message's topic).  Wire taps should _not_ be used in lieu of an actual subscription - but instead should be used for diagnostics, logging, forwarding (to a websocket publisher, for example) or other concerns that fall along those lines.

## Can I contribute?
Please - by all means!  While I hope the API is relatively stable, I'm open to pull requests.  (Hint - if you want a feature implemented, a pull request gives it a much higher probability of being included than simply asking me.)  As I said, pull requests are most certainly welcome - but please include tests for your additions.  Otherwise, it will disappear into the ether.

## Roadmap for the Future
Here's where Postal is headed:

* I haven't yet thoroughly tested Postal on Node.js - that is high on my list as well.
* What else would you like to see?