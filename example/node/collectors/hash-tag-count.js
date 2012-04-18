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
	HashTagCount = function(namespace) {
		this.namespace = namespace;

		this.events = {};

	    this.hashTags   = { list: [], registry: {} };

	    this.lastStats = undefined;

	};

HashTagCount.prototype = {
	init: function() {
		this.hashTags   = { list: [], registry: {} };
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
	processNewTweets: function( tweets ) {
		tweets.forEach( function( tweet ){
			this.processOtherHashTags( tweet.text );
		}, this );
		this.lastStats = { type: "HashTagCount", hashTags: this.hashTags.list };
		this.raiseEvent( this.namespace, this.lastStats );
	},
	processOtherHashTags: function( text ) {
		_scanner( /#(\w*)/i, text, function( hash ){
			if( !this.hashTags.registry[ hash ] ) {
				var obj = { hashTag: hash, count: 0 };
				this.hashTags.registry[ hash ] = obj;
				this.hashTags.list.push( obj );
			}
			this.hashTags.registry[ hash ].count++;
		}.bind( this ));
	}
};

module.exports = HashTagCount;