var query = require('querystring'),
	http = require('http');

var client = http.createClient(80, "search.twitter.com");

var TwitterSearch = function (refreshInterval) {
	this.events = {};

	this.timeoutFn = undefined;

	this.searchPath = "/search.json";

	this.refreshInterval = refreshInterval || 5000;

	this.searchRegistry = {};

	this.tweetRegistry = {};

	this.defaultSearch = {};

	this.nextSearch = undefined;
};

TwitterSearch.prototype = {
	search      :function (searchTerm) {
		console.log("TwitterSearch got an init: " + searchTerm);
		clearTimeout(this.timeoutFn);
		this.defaultSearch = {
			q          : searchTerm,
			result_type: "recent",
			rpp        : 100
		};
		this.nextSearch = undefined;
		this.searchRegistry = {};
		this.tweetRegistry = {};
		this.runSearch();
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
	buildUrl  :function () {
		var srchQry;
		if (this.nextSearch) {
			srchQry = this.nextSearch;
		}
		else {
			if (!this.defaultSearch.since_id) {
				delete this.defaultSearch.since_id;
			}
			srchQry = "?" + query.stringify(this.defaultSearch);
		}
		return this.searchPath + srchQry;
	},

	runSearch    :function () {
		var url = this.buildUrl();
		if (!this.searchRegistry[url]) {
			this.searchRegistry[url] = true;
			this.raiseEvent( "search.current", { url: url } );
			var request = client.request("GET", url, {"host":"search.twitter.com"});
			request.addListener("response", function (response) {
				var body = "";
				response.addListener("data", function (data) {
					body += data;
				});

				response.addListener("end", function () {
					this.onSearched(JSON.parse(body));
				}.bind(this));
				this.timeoutFn = setTimeout(this.runSearch.bind(this), this.refreshInterval);
			}.bind(this));
			request.end();
		}
		else {
			this.raiseEvent( "search.nodata", { url: url } );
			this.timeoutFn = setTimeout(this.runSearch.bind(this), this.refreshInterval);
		}
	},
	onSearched   :function (payload) {
		// sift out errors
		if (!payload.error) {
			if (payload.results.length > 0) {
				this.processTweets(payload.results);
			}
			// do we have a next page option?  If so, let's use it
			if (payload.next_page) {
				this.nextSearch = payload.next_page;
			}
			if (payload.max_id) {
				this.defaultSearch.since_id = payload.max_id;
			}
		}
		else {
			this.nextSearch = undefined;
		}
	},
	processTweets:function (tweets) {
		var newTweets = tweets.filter(function (t) {
			return !this.tweetRegistry[t];
		}, this);
		newTweets.forEach(function (tweet) {
			if (!this.tweetRegistry[tweet.id]) {
				this.tweetRegistry[tweet.id] = true;
			}
			// deal with the images that consistently fail from twitter...
			if (tweet.profile_image_url === "http://twitter.com/images/default_profile_normal.png" ||
				tweet.profile_image_url === "http://static.twitter.com/images/default_profile_normal.png") {
				tweet.profile_image_url = "templates/images/default_profile_1_normal.png";
			}
		}, this);
		this.raiseEvent("newTweets", newTweets );
	}
};


module.exports = TwitterSearch;