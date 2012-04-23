define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/tweet-count.html',
	'models/stat-model',
	'bus'
],
	function ( $, ManagedView, template, TweetCountModel, bus ) {
		"use strict";

		return ManagedView.extend( {
			tagName : "div",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new TweetCountModel({
					tweeters : []
				}, [
					bus.stats.subscribe( "tweet-count", function ( data, env ) {
						if ( data.tweeters && data.tweeters.length ) {
							this.set( "tweeters", _.sortBy( data.tweeters, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ) ,
					bus.app.subscribe( "search.init", function () {
						this.set( "tweeters", [] );
					} )
				]);
				bus.app.subscribe( "search.info", this.setCurrentSearch );
				this.model.bind( "change", this.render );
				this.inDom = false;
				bus.stats.publish( { topic : "tweet-count.getLatest", data : {} } );
			},

			render : function () {
				// TODO: Capture scroll position and restore after render...
				this.$el.html( this.template( this.model.toJSON() ) );
				if ( !this.inDom ) {
					this.$el.appendTo( "#stats" );
					this.inDom = true;
				}
			}
		} );
	} );