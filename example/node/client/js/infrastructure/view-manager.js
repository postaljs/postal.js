define( [
	'underscore',
	'bus'
], function ( _, bus ) {
	var ViewManager = function () {
		this.views = {};                // holds the views that are registered with the manager
		this.UI = {};                   // holds the UI configurations that are defined
		this.priorContext = undefined;  // holds the name of the last UI configuration
	};

	//----------------------------------------------------------------------------
	// registerView - registers a view with the manager, under the name provided.
	// The handle to the constructor function (second arg) is used to create an
	// instance of the view the first time getInstance is called.  The rendered
	// and visible booleans are used by the ViewManager to track state of the view.
	// The getInstance call can take an options object.  If options.forceNew = true,
	// then the ViewManager will create a new instance of the view.  If options.args
	// exists, it will be passed into the constructor function of the view.
	//----------------------------------------------------------------------------
	ViewManager.prototype.registerView = function ( name, viewCtor ) {
		this.views[name] = {
			rendered : false,
			visible : false,
			getInstance : (function () {
				var _instance;
				return function ( options ) {
					var _options = options || {};
					if ( !_instance || _options.forceNew ) {
						_instance = new viewCtor( _options.args || {} );
					}
					return _instance;
				}
			})()
		}
	};

	ViewManager.prototype.registerViews = function ( views ) {
		_.each( views, function ( view ) {
			this.registerView( view.name, view.ctor );
		}, this );
	};

	//----------------------------------------------------------------------------
	// defineUI - defines a UI configuration, which is effectively a named group
	// of views that need to be stood up, in order.  The first argument is the UI
	// name, second arg is the array of view names (in the order they need to be
	// instantiated/rendered/shown)
	//----------------------------------------------------------------------------
	ViewManager.prototype.defineUI = function ( name, dependencies, options ) {
		var self = this;
		self.UI[ name ] = {
			options : options || {},
			dependencies : dependencies,
			activate : function ( data ) {
				data = data || {};
				data.priorContext = self.priorContext;
				data.targetContext = name;

				if ( !this.options.noHide ) {
					// hide anything visible that's not in the dependencies for this UI configuration
					var shouldHide = _.reduce( self.views, function ( memo, val, key ) {
						if ( val.visible && !_.include( this.dependencies, key ) ) {
							memo.push( key );
						}
						return memo;
					}, [], this );

					_.each( shouldHide, function ( viewName ) {
						var instance = self.views[ viewName ].getInstance();
						if ( instance.hide ) {
							instance.hide();
						}
						self.views[ viewName ].visible = false;
					} );
				}

				// set up, render & show the dependencies for this UI configuration
				_.each( this.dependencies, function ( viewName ) {
					var instance = self.views[viewName].getInstance( data );
					if ( !self.views[viewName].rendered ) {
						instance.render( data );
						self.views[viewName].rendered = true;
					}
					if ( !self.views[viewName].visible ) {
						if ( instance.show ) {
							instance.show( data );
						}
						self.views[viewName].visible = true;
					}

					if ( instance.update ) {
						instance.update( data );
					}
				} );
				self.priorContext = name;
			}
		};
	};

	ViewManager.prototype.defineUIs = function ( uis ) {
		_.each( uis, function ( ui ) {
			this.defineUI( ui.name, ui.dependencies, ui.options );
		}, this );
	};

	ViewManager.prototype.addViewToUI = function ( uiName, viewName, viewCtor ) {
		var uis = _.isArray( uiName ) ? uiName : [ uiName ];

		if ( !this.views[ viewName ] ) {
			this.registerView( viewName, viewCtor );
		}

		_.each( uis, function ( ui ) {
			if ( this.UI[ ui ] ) {
				this.UI[ ui ].dependencies.push( viewName );
			}
		}, this );
	};

	return ViewManager;
} );