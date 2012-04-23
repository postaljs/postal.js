define( [
	'jquery',
	'backbone',
	'bus',
	'infrastructure/router',
	'infrastructure/view-manager',
	'views/container',
	'views/menu',
	'views/tweet-count',
	'views/mention-count',
	'views/mentioner-count',
	'views/hash-tag-count',
	'views/profanity-percentage',
	'views/search-requests',
	'views/wiretap',
], function ( $, Backbone, bus, Router, ViewManager, ContainerView, MenuView, TweetCountView,
              MentionCountView, MentionerCountView, HashTagCountView, ProfanityPercentage,
              SearchRequestView, WiretapView ) {
	var app = {
		bus : bus,
		router : new Router()
	};

	// Set up UI concerns
	app.viewManager = new ViewManager();
	app.bus.viewManager.subscribe( "ui.show", function ( data, env ) {
		app.viewManager.UI[ data.name ].activate( data.context );
	} );

	app.viewManager.registerViews( [
		{ name : "container",           ctor : ContainerView       },
		{ name : "menu",                ctor : MenuView            },
		{ name : "tweetCount",          ctor : TweetCountView      },
		{ name : "mentionCount",        ctor : MentionCountView    },
		{ name : "mentionerCount",      ctor : MentionerCountView  },
		{ name : "hashTagCount",        ctor : HashTagCountView    },
		{ name : "profanityPercentage", ctor : ProfanityPercentage },
		{ name : "searchRequests",      ctor : SearchRequestView   },
		{ name : "wiretap",             ctor : WiretapView         }
	] );
	app.viewManager.defineUIs( [
		{ name : "homeUI", dependencies : [ "container", "menu", "tweetCount", "mentionCount", "mentionerCount", "hashTagCount", "profanityPercentage" ] },
		{ name : "searchRequestUI", dependencies : [ "container", "menu", "searchRequests" ] },
		{ name : "wireTapLogUI", dependencies : [ "container", "menu", "wiretap" ] }
	] );

	$( function () {
		Backbone.history.start( {
			pushState : true,
			root : $( "base" ).attr( "href" )
		} );
	} );

	return app;
} );