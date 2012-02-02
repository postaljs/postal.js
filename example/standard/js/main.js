$(function(){
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
		.publish({ type: "Companion Name", value:"Rose" });
	postal.channel("DrWho.TenthDoctor.Companion.Changed")
		.publish({ type: "Companion Name", value:"Martha" });
	postal.channel("DrWho.Eleventh.Companion.Changed")
		.publish({ type: "Companion Name", value:"Amy" });
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
});