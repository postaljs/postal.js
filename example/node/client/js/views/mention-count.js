define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/mention-count.html',
	'models/stat-model',
	'bus'
],
	function ( $, ManagedView, template, MentionCountModel, bus ) {
		"use strict";

		return ManagedView.extend( {
			tagName : "div",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new MentionCountModel({ mentions : [] },[
					bus.stats.subscribe( "mention-count", function ( data, env ) {
						if ( data.mentions && data.mentions.length ) {
							this.set( "mentions", _.sortBy( data.mentions, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ),
					bus.app.subscribe( "search.init", function () {
						this.set( "mentions", [] );
					} )
				]);
				bus.app.subscribe( "search.info", this.setCurrentSearch );
				this.model.bind( "change", this.render );
				this.inDom = false;
				bus.stats.publish( { topic : "mention-count.getLatest", data : {} } );
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