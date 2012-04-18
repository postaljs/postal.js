var _ = require('underscore'),
	_scanner = function(regExp, text, callback) {
		var match;
		while(text.search(regExp) !== -1) {
			match = regExp.exec(text);
			if(match && match[1]) {
				callback(match[1].toLowerCase());
			}
			text = text.replace(regExp, "");
		}
	},
	MentionCount = function(namespace) {
		this.namespace = namespace;

		this.events = {};

		this.mentions = { list: [], registry: {} };

		this.userImageMap = {};

	    this.lastStats = undefined;
	};

MentionCount.prototype = {
	init: function() {
		this.mentions   = { list: [], registry: {} };
		this.lastStats = undefined;
	},
	on: function( eventName, callback ) {
		if( !this.events[ eventName ] ) {
			this.events[ eventName ] = [];
		}
		this.events[ eventName ].push( callback );
		return function() {
			this.events[ eventName ] = _.without( this.events[ eventName ], callback );
		}.bind( this );
	},
	raiseEvent: function( eventName, data ) {
		if( this.events[ eventName ] ) {
			this.events[ eventName ].forEach( function( callback ){
				callback( data );
			});
		}
	},
	processNewTweets: function(tweets) {
		tweets.forEach(function(tweet){
			this.userImageMap[ tweet.from_user ] = tweet.profile_image_url;
			this.processMentions(tweet);
		}, this);
		this.tryToMatchProfileImages();
		this.lastStats = { type: "MentionCount", mentions: this.mentions.list };
		this.raiseEvent( this.namespace, this.lastStats );
	},
	tryToMatchProfileImages: function() {
		_.each( this.mentions.registry, function( v, k ){
			if( this.userImageMap[ k ] ) {
				v.image = this.userImageMap[ k ];
			}
		}, this );
	},
	processMentions: function(tweet) {
		_scanner(/@(\w*)/i, tweet.text, function(mentioned) {
			if(!this.mentions.registry[mentioned]) {
				var obj = { user: mentioned, count: 0, image: "images/default_profile_1_normal.png" };
				this.mentions.registry[mentioned] = obj;
				this.mentions.list.push(obj);
			}
			this.mentions.registry[mentioned].count++;
		}.bind(this));
	}
};

module.exports = MentionCount;