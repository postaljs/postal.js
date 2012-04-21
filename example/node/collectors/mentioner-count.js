var _ = require( 'underscore' ),
	_scanner = function ( regExp, text, callback ) {
		var match;
		while ( text.search( regExp ) !== -1 ) {
			match = regExp.exec( text );
			if ( match && match[1] ) {
				callback( match[1].toLowerCase() );
			}
			text = text.replace( regExp, "" );
		}
	},
	MentionerCount = function ( namespace ) {
		this.namespace = namespace;

		this.events = {};

		this.mentioners = { list : [], registry : {} };

		this.lastStats = undefined;
	};

MentionerCount.prototype = {
	init : function () {
		this.mentioners = { list : [], registry : {} };
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
				callback( data );
			} );
		}
	},
	processNewTweets : function ( tweets ) {
		tweets.forEach( function ( tweet ) {
			this.processMentioners( tweet );
		}, this );
		this.lastStats = { type : "MentionerCount", mentioners : this.mentioners.list };
		this.raiseEvent( this.namespace, this.lastStats );
	},
	processMentioners : function ( tweet ) {
		_scanner( /@(\w*)/i, tweet.text, function ( mentioned ) {
			if ( !this.mentioners.registry[tweet.from_user] ) {
				var obj = { user : tweet.from_user, count : 0, image : tweet.profile_image_url };
				this.mentioners.registry[tweet.from_user] = obj;
				this.mentioners.list.push( obj );
			}
			this.mentioners.registry[tweet.from_user].count++;
		}.bind( this ) );
	}
};

module.exports = MentionerCount;