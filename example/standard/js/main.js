$( function () {
	// This gets you a handle to the default postal channel...
	var channel = postal.channel();
	// subscribe
	var subscription = channel.subscribe( "Name.Changed", function ( data ) {
		$( "#example1" ).html( "Name: " + data.name );
	} );
	// And someone publishes a first name change:
	channel.publish( "Name.Changed", { name : "Dr. Who" } );
	subscription.unsubscribe();


	// Subscribing to a wildcard topic using #
	// The # symbol represents "one word" in a topic (i.e - the text between two periods of a topic).
	// By subscribing to "#.Changed", the binding will match
	// Name.Changed & Location.Changed but *not* for Changed.Companion
	var chgSubscription = channel.subscribe( "#.Changed", function ( data ) {
		$( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example2" );
	} );
	channel.publish( "Name.Changed", { type : "Name", value : "John Smith" } );
	channel.publish( "Location.Changed", { type : "Location", value : "Early 20th Century England" } );
	chgSubscription.unsubscribe();


	// Subscribing to a wildcard topic using *
	// The * symbol represents any number of characters/words in a topic string.
	// By subscribing to "DrWho.*.Changed", the binding will match
	// DrWho.NinthDoctor.Companion.Changed & DrWho.Location.Changed but *not* Changed
	var starSubscription = channel.subscribe( "DrWho.*.Changed", function ( data ) {
		$( '<li>' + data.type + " Changed: " + data.value + '</li>' ).appendTo( "#example3" );
	} );
	channel.publish( "DrWho.NinthDoctor.Companion.Changed", { type : "Companion Name", value : "Rose" } );
	channel.publish( "DrWho.TenthDoctor.Companion.Changed", { type : "Companion Name", value : "Martha" } );
	channel.publish( "DrWho.Eleventh.Companion.Changed", { type : "Companion Name", value : "Amy" } );
	channel.publish( "DrWho.Location.Changed", { type : "Location", value : "The Library" } );
	channel.publish( "TheMaster.DrumBeat.Changed", { type : "DrumBeat", value : "This won't trigger any subscriptions" } );
	channel.publish( "Changed", { type : "Useless", value : "This won't trigger any subscriptions either" } );
	starSubscription.unsubscribe();

	// Applying distinctUntilChanged to a subscription
	var dupSubscription = channel.subscribe( "WeepingAngel.*",
		function ( data ) {
			$( '<li>' + data.value + '</li>' ).appendTo( "#example4" );
		} ).distinctUntilChanged();
	channel.publish( "WeepingAngel.DontBlink", { value : "Don't Blink" } );
	channel.publish( "WeepingAngel.DontBlink", { value : "Don't Blink" } );
	channel.publish( "WeepingAngel.DontEvenBlink", { value : "Don't Even Blink" } );
	channel.publish( "WeepingAngel.DontBlink", { value : "Don't Close Your Eyes" } );
	channel.publish( "WeepingAngel.DontBlink", { value : "Don't Blink" } );
	channel.publish( "WeepingAngel.DontBlink", { value : "Don't Blink" } );
	dupSubscription.unsubscribe();

	// Using disposeAfter(X) to remove subscription automagically after X number of receives
	var daSubscription = channel.subscribe( "Donna.Noble.*",
		function ( data ) {
			$( '<li>' + data.value + '</li>' ).appendTo( "#example5" );
		} ).disposeAfter( 2 );
	channel.publish( "Donna.Noble.ScreamingAgain", { value : "Donna Noble has left the library." } );
	channel.publish( "Donna.Noble.ScreamingAgain", { value : "Donna Noble has left the library." } );
	channel.publish( "Donna.Noble.ScreamingAgain", { value : "Donna Noble has left the library." } );
	channel.publish( "Donna.Noble.ScreamingAgain", { value : "Donna Noble has left the library." } );
	channel.publish( "Donna.Noble.ScreamingAgain", { value : "Donna Noble has left the library." } );
	daSubscription.unsubscribe();

	// Using withConstraint to apply a predicate to the subscription
	var drIsInTheTardis = false,
		wcSubscription = channel.subscribe( "Tardis.Depart",
			function ( data ) {
				$( '<li>' + data.value + '</li>' ).appendTo( "#example6" );
			} ).withConstraint( function () {
				return drIsInTheTardis;
			} );
	channel.publish( "Tardis.Depart", { value : "Time for time travel....fantastic!" } );
	channel.publish( "Tardis.Depart", { value : "Time for time travel....fantastic!" } );
	drIsInTheTardis = true;
	channel.publish( "Tardis.Depart", { value : "Time for time travel....fantastic!" } );
	wcSubscription.unsubscribe();

	// Using withContext to set the "this" context
	var ctxSubscription = channel.subscribe( "Dalek.Meet.CyberMen",
		function ( data ) {
			$( '<li>' + data.value + '</li>' ).appendTo( this );
		} ).withContext( $( "#example7" ) );
	channel.publish( "Dalek.Meet.CyberMen", { value : "Exterminate!" } );
	channel.publish( "Dalek.Meet.CyberMen", { value : "Delete!" } );
	ctxSubscription.unsubscribe();

	// Using withDelay() to delay the subscription evaluation
	var wdSubscription = channel.subscribe( "He.Will.Knock.Four.Times",
		function ( data ) {
			$( '<li>' + data.value + '</li>' ).appendTo( $( "#example8" ) );
		} ).withDelay( 5000 );
	channel.publish( "He.Will.Knock.Four.Times", { value : "Knock!" } );
	channel.publish( "He.Will.Knock.Four.Times", { value : "Knock!" } );
	channel.publish( "He.Will.Knock.Four.Times", { value : "Knock!" } );
	channel.publish( "He.Will.Knock.Four.Times", { value : "Knock!" } );
	wdSubscription.unsubscribe();

	// Using distinct() to ignore duplicate messages
	var revealSubscription = channel.subscribe( 'detect.cylon',function ( who ) {
		$( '<li></li>' ).text( who.name ).appendTo( $( '#example9' ) );
	} ).distinct();
	channel.publish( 'detect.cylon', {name : 'Boomer'} );
	channel.publish( 'detect.cylon', {name : 'Saul Tigh'} );
	channel.publish( 'detect.cylon', {name : 'William Adama'} );
	channel.publish( 'detect.cylon', {name : 'Helo'} );
	channel.publish( 'detect.cylon', {name : 'Boomer'} ); //ignored!
	channel.publish( 'detect.cylon', {name : 'Felix Gaeta'} );
	channel.publish( 'detect.cylon', {name : 'William Adama'} );//ignored!
} );