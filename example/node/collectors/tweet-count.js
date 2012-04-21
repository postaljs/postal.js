var _ = require( 'underscore' ),
	TweetCount = function ( namespace ) {
		this.namespace = namespace;

		this.events = {};

		this.tweeters = { list : [], registry : {} };

		this.lastStats = undefined;
	};

TweetCount.prototype = {
	init : function () {
		this.tweeters = { list : [], registry : {} };
		this.lastStats = undefined;
	},
	on : function ( eventName, callback ) {
		if ( !this.events[ eventName ] ) {
			this.events[ eventName ] = [];
		}
		this.events[ eventName ].push( callback );
		return function () {
			this.events[ eventName ] = _.without( this.events[ eventName ], callback );
		}.bind( this );
	},
	raiseEvent : function ( eventName, data ) {
		if ( this.events[ eventName ] ) {
			this.events[ eventName ].forEach( function ( callback ) {
				callback.call( this, data );
			} );
		}
	},
	processNewTweets : function ( tweets ) {
		tweets.forEach( function ( tweet ) {
			this.processTweetCount( tweet );
		}, this );
		this.lastStats = { type : "TweetCount", tweeters : this.tweeters.list };
		this.raiseEvent( this.namespace, this.lastStats );
	},
	processTweetCount : function ( tweet ) {
		if ( tweet.from_user ) {
			if ( !this.tweeters.registry[tweet.from_user] ) {
				var obj = {user : tweet.from_user, count : 0, image : tweet.profile_image_url};
				this.tweeters.registry[tweet.from_user] = obj;
				this.tweeters.list.push( obj );
			}
			this.tweeters.registry[tweet.from_user].count++;
		}
	}
};

module.exports = TweetCount;