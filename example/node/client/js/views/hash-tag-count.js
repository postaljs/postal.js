define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/hash-tag-count.html',
	'models/stat-model',
	'bus'
],
	function ( $, ManagedView, template, HashTagCountModel, bus ) {
		"use strict";

		return ManagedView.extend({
			tagName : "div",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new HashTagCountModel({ hashTags : [] }, [
					bus.stats.subscribe( "hash-tag-count", function ( data, env ) {
						if ( data.hashTags && data.hashTags.length ) {
							this.set( "hashTags", _.sortBy( data.hashTags, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ),
					bus.app.subscribe( "search.init", function () {
						this.set( "hashTags", [] );
					} )
				]);
				bus.app.subscribe( "search.info", this.setCurrentSearch );
				this.model.bind( "change", this.render );
				this.inDom = false;
				bus.stats.publish( { topic : "hash-tag-count.getLatest", data : {} } );
			},

			render : function () {
				// TODO: Capture scroll position and restore after render...
				this.$el.html( this.template( this.model.toJSON() ) );
				if ( !this.inDom ) {
					this.$el.appendTo( "#stats" );
					this.inDom = true;
				}
			}
		});
	} );