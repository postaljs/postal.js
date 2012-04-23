define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/mentioner-count.html',
	'models/stat-model',
	'bus'
],
	function ( $, ManagedView, template, MentionerCountModel, bus ) {
		"use strict";

		return ManagedView.extend( {
			tagName : "div",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new MentionerCountModel({ mentioners: [] }, [
					bus.stats.subscribe( "mentioner-count", function ( data, env ) {
						if ( data.mentioners && data.mentioners.length ) {
							this.set( "mentioners", _.sortBy( data.mentioners, function ( item ) {
								return item.count * -1;
							} ) );
						}
					} ),
					bus.app.subscribe( "search.init", function () {
						this.set( "mentioners", [] );
					} )
				]);
				bus.app.subscribe( "search.info", this.setCurrentSearch );
				this.model.bind( "change", this.render );
				this.inDom = false;
				bus.stats.publish( { topic : "mentioner-count.getLatest", data : {} } );
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