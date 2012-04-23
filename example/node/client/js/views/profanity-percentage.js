define( [
	'jquery',
	'views/managed-view',
	'text!views/templates/profanity-percentage.html',
	'models/stat-model',
	'bus'
],
	function ( $, ManagedView, template, ProfanityPercentageModel, bus ) {
		"use strict";

		return ManagedView.extend( {
			tagName : "div",

			initialize : function () {
				ManagedView.prototype.initialize.call(this, template);
				this.model = new ProfanityPercentageModel({
					percentage : "",
					clean : "",
					explicit : "",
					total : ""
				},[
					bus.stats.subscribe( "profanity-percentage", function ( data, env ) {
						this.set( "percentage", data.percentage, { silent : true } );
						this.set( "clean", data.clean, { silent : true } );
						this.set( "explicit", data.explicit, { silent : true } );
						this.set( "total", data.clean + data.explicit, { silent : true } );
						this.change();
					} ),
					bus.app.subscribe( "search.init", function () {
						this.set( "percentage", "", { silent : true } );
						this.set( "clean", "", { silent : true } );
						this.set( "explicit", "", { silent : true } );
						this.set( "total", "", { silent : true } );
						this.change();
					} )
				]);
				bus.app.subscribe( "search.info", this.setCurrentSearch );
				this.model.bind( "change", this.render );
				this.inDom = false;
				bus.stats.publish( { topic : "profanity-percentage.getLatest", data : {} } );
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