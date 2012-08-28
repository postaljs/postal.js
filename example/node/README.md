# postal.js sample app with browser and node.js components

## Explanation

As much as I want to convince you that this sample app was written with you in mind, I'd be lying if I said so.  The browser examples in this repo are currently "bare bones", with no real usage examples beyond calling the API in browser js and then calling it a day.  I wanted to demonstrate node.js usage of postal as well, and that gave birth to this example project.

## How to run

Open a terminal/console to the example/node directory and run `node index.js`.  Then open a browser to http://localhost:8002.  Once you enter a search term in the client UI, it will trigger the server side twitter search module to start searching, etc.

## The Good, the Bad & the Caveats

##The Good:

* You'll see postal.js used in node.js and in the browser (#winning?)
* This is way beyond a hello world example
* The browser and node.js postal instances are being *bridge* by a websocket connection (geek brownie points, FTW)
* I demonstrate a general usage pattern I've fallen into with the node.js side of things, which I call "Local message bus at boundaries, events internal."
	* Note that the node/messaging/ folder contains "bus-adapter.js" and "collector-adapter.js"
	* These modules exist to adapt other bus-agnostics modules to postal.js
	* The "bus agnostic" modules (for ex. - anything in the "collectors" directory) can work just fine without a message bus in place, but any subscribers would have to have a direct reference to the module, causing the application to be more tightly coupled.
	* The adapters wrap the standard "events" that a module can produce and act as a bridge to then publish those events onto the message bus.  This enables other clients to subscribe to said events without needing to know anything explicit about the event producer beyond the structure of the message (the message *is* the contract).

##The Bad:

* I have (had?) high hopes to refactor this into better organized code, but alas, I have a wife, two kids, friends, other OSS projects and about 200 books on my amazon wish list.  So, while the code is readable, it's more verbose than it should be.
* *IF* I get to refactor anything, I would target things like:
	* Less verbose app-level FSM on the node.js side
	* Tie postal.js into the Backbone.Sync process so that models could transparently get updates from the server w/o having to know about subscriptions for updates
	* More comments - especially around the bus-adapter/collector adpaters in the node.js code

##The Caveats:

* The web socket bridge in use in this project (postal.socket) is *highly experimental*!  A real version is in the works, but this project served as a test bed for ideas I had floating around in my brain.
* The actual functionality of this example app is truly silly and arbitrary:
	* clients connect and the first one to enter a search term owns the search until they disconnect or give control to another client
	* search terms are used against twitter's "REST-ish" API (not the stream)
	* as the server-side search agent gets tweet results, it publishes them local to node.js for the stat collectors to aggregate and produce stats
	* stat collectors publish messages to which browser clients have subscribed (browser clients have a "socket" channel type thanks to the experimental postal.socket plugin that subscribes not only locally, but pushes the subscription to the other end of the socket on the server side, causing messages on the server for that susbcription to be pushed over the socket, back to the client.)
	* If a client that doesn't own the search submits a search request, the owner can go to the "Search Requests" link on the top navbar and click on the term they want to allow.  This gives control to the requester.
* Beyond simple playing in the browser and repl, I've not performed any major testing of this app - good grief, man, it's a sample app I've written while mostly half asleep :-)

More real-world sample applications using postal will be included in this repository as I build ones I'm at liberty to share.

Thanks a ton for reading this if you made it this far.  *You* are exactly why I write this stuff!
