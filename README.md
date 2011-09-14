# Postal.js

## What is it?
Postal.js is a JavaScript pub/sub library that can be used in the browser, or on the server-side using Node.js. It extends the "eventing" paradigm most JavaScript developers are already familiar with.

## Why would I use it?
If you are looking to decouple the various components/libraries/plugins you use (client-or-server-side), applying messaging can enable you to not only easily separate concerns, but also enable you to more painlessly plug in additional components/functionality in the future.  A pub/sub library like Postal.js can assist you in picking & choosing the libraries the best address the problems you're trying to solve, without burdening you with the requirement that those libraries have to be natively interoperable.  For example:

* If you're using a client-side binding framework, and either don't have - or don't like - the request/communication abstractions provided, then grab a library like amplify.js or reqwest.  Then, instead of tightly coupling the two, have the request success/error callbacks publish messages with the appropriate data and any subscribers you've wired up can handle applying the data to the specific objects/elements they're concerned with.
* Do you need two view models to communicate, but you don't want them to need to know about each other?  Have them subscribe to the topics about which they are interested in receiving messages.  From there, whenever a view model needs to alert any listeners of specific data/events, just publish a message to the bus.  If the other view model is present, it will receive the notification.
* Want to wire up your own binding framework?  Want to control the number of times subscription callbacks get invoked within a given time frame? Want to keep subscriptions from being fired until after data stops arriving? Want to keep events from being acted upon until the UI event loop is done processing other events?  These - and more - are all things Postal can do for you.

## Wut?  Another pub/sub library?
Why, yes.  There are great alternatives to Postal.  If you need something leaner for client-side development, look at amplify.js.  If you're in Node.js and can get by with EventEmitter, great.  However, I discovered that as my needs quickly grew, I wanted something that was as lean as possible, without sacrificing some of the more complex functionality that's not provided by libraries like amplify.js, and the EventEmitter object in Node.

## How do I use it?
In a nutshell, Postal provides an in-memory message bus, where clients subscribe to a topic (which can include wildcards, as we'll see), and publishers publish messages (passing a topic along with it).  Postal's "bindingResolver" handles matching a published message's topic to subscribers who should be notified of the message.  When a client subscribes, they pass a callback that should be invoked whenever a message comes through.  This callback takes one argument - the "data" payload of the message.  Messages do not *have* to include data (they can simply be used to indicate an event, and not transmit additional state).  In the examples below, we'll see that you can call postal.publish() and postal.subscribe() directly, but you also have a much more intuitive option to fluently configure your subscription and publish handles.

All of these examples can be run live here: [http://jsfiddle.net/ifandelse/NTPcT/](http://jsfiddle.net/ifandelse/NTPcT/)

<iframe style="width: 100%; height: 300px" src="http://jsfiddle.net/ifandelse/NTPcT/embedded/"></iframe>

JavaScript:

    // The world's simplest subscription
    var channel = postal.channel("Name.Changed");
    // subscribe
    var subscription = channel.subscribe(function(data) { $("#example1").html("Name: " + data.name); });
    // And someone publishes a first name change:
    channel.publish({ name: "Dr. Who" });
    subscription.unsubscribe();



    // Subscribing to a wildcard topic using #
    // The # symbol represents "one word" in a topic (i.e - the text between two periods of a topic).
    // By subscribing to "#.Changed", the binding will match
    // Name.Changed & Location.Changed but *not* for Changed.Companion
    var hashChannel = postal.channel("#.Changed"),
        chgSubscription = hashChannel.subscribe(function(data) {
            $('<li>' + data.type + " Changed: " + data.value + '</li>').appendTo("#example2");
        });
    postal.channel("Name.Changed")
          .publish({ type: "Name", value:"John Smith" });
    postal.channel("Location.Changed")
          .publish({ type: "Location", value: "Early 20th Century England" });
    chgSubscription.unsubscribe();



    // Subscribing to a wildcard topic using *
    // The * symbol represents any number of characters/words in a topic string.
    // By subscribing to "DrWho.*.Changed", the binding will match
    // DrWho.NinthDoctor.Companion.Changed & DrWho.Location.Changed but *not* Changed
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



    // Applying ignoreDuplicates to a subscription
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



    // Using disposeAfter(X) to remove subscription automagically after X number of receives
    var daChannel = postal.channel("Donna.Noble.*"),
        daSubscription = daChannel.subscribe(function(data) {
                              $('<li>' + data.value + '</li>').appendTo("#example5");
                          }).disposeAfter(2);
    postal.channel("Donna.Noble.ScreamingAgain")
          .publish({ value:"Donna Noble has left the library." });
    postal.channel("Donna.Noble.ScreamingAgain")
          .publish({ value:"Donna Noble has left the library." });
    postal.channel("Donna.Noble.ScreamingAgain")
          .publish({ value:"Donna Noble has left the library." });
    postal.channel("Donna.Noble.ScreamingAgain")
          .publish({ value:"Donna Noble has left the library." });
    postal.channel("Donna.Noble.ScreamingAgain")
          .publish({ value:"Donna Noble has left the library." });
    daSubscription.unsubscribe();



    // Using whenHandledThenExecute() to invoke a function after handling a message
    var whteChannel = postal.channel("Donna.Noble.*"),
        whteSubscription = whteChannel.subscribe(function(data) {
                              $('<li>' + data.value + '</li>').appendTo("#example6");
                           }).whenHandledThenExecute(function() {
                               $('<li>[Kind of a frivolous example...but this line resulted from the whenHandledThenExecute() callback]</li>').appendTo("#example6");
                           });
    postal.channel("Donna.Noble.*")
          .publish({ value:"Donna Noble has left the library." });
    whteSubscription.unsubscribe();



    // Using withConstraint to apply a predicate to the subscription
    var drIsInTheTardis = false,
        wcChannel = postal.channel("Tardis.Depart"),
        wcSubscription = wcChannel.subscribe(function(data) {
                              $('<li>' + data.value + '</li>').appendTo("#example7");
                         }).withConstraint(function() { return drIsInTheTardis; } );
    postal.channel("Tardis.Depart")
          .publish({ value:"Time for time travel....fantastic!" });
    postal.channel("Tardis.Depart")
          .publish({ value:"Time for time travel....fantastic!" });
    drIsInTheTardis = true;
    postal.channel("Tardis.Depart")
          .publish({ value:"Time for time travel....fantastic!" });
    wcSubscription.unsubscribe();



    // Using withContext to set the "this" context
    var ctxChannel = postal.channel("Dalek.Meet.CyberMen"),
        ctxSubscription = ctxChannel.subscribe(function(data) {
                              $('<li>' + data.value + '</li>').appendTo(this);
                         }).withContext($("#example8"));
    postal.channel("Dalek.Meet.CyberMen")
          .publish({ value:"Exterminate!" });
    postal.channel("Dalek.Meet.CyberMen")
          .publish({ value:"Delete!" });
    ctxSubscription.unsubscribe();



    // Using withDelay() to delay the subscription evaluation
    var wdChannel = postal.channel("He.Will.Knock.Four.Times"),
        wdSubscription = wdChannel.subscribe(function(data) {
                              $('<li>' + data.value + '</li>').appendTo($("#example9"));
                         }).withDelay(5000);
    postal.channel("He.Will.Knock.Four.Times")
          .publish({ value:"Knock!" });
    postal.channel("He.Will.Knock.Four.Times")
          .publish({ value:"Knock!" });
    postal.channel("He.Will.Knock.Four.Times")
          .publish({ value:"Knock!" });
    postal.channel("He.Will.Knock.Four.Times")
          .publish({ value:"Knock!" });
    wdSubscription.unsubscribe();


## How can I extend it?
There are two main ways you can extend Postal:

* First, you can write an entirely new bus implementation (want to tie into a real broker like AMQP, and wrap it with Postal's API?  This is how you'd do it.).  If you want to do this, look over the "localBus" implementation to see how the core version works.  Then, you can simply swap the bus implementation out by calling: postal.configuration.bus = myWayBetterBusImplementation.
* The second way you can extend Postal is to change how the bindingResolver works.  You may not care for the RabbitMQ-style bindings functionality.  No problem!  Write your own resolver object that implements a "compare" method and swap the core version out with your implementation by calling: postal.configuration.resolver = myWayBetterResolver.

It's also possible to extend the monitoring of messages passing through Postal by adding a "wire tap".  A wire tap is a callback that will get invoked for any published message (even if no actual subscriptions would bind to the message's topic).  Wire taps should _not_ be used in lieu of an actual subscription - but instead should be used for diagnostics, logging, forwarding or other concerns that fall along those lines.

## Can I contribute?
Please - by all means!  While I hope the API is relatively stable, I'm open to pull requests.  (Hint - if you want a feature implemented, a pull request gives it a much higher probability of being included than simply asking me.)  As I said, pull requests are most certainly welcome - but please include tests for your additions.  Otherwise, it will disappear into the ether.