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

## How can I extend it?