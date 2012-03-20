(function(root, doc, factory) {
	if (typeof define === "function" && define.amd) {
		// AMD. Register as an anonymous module.
		define(["postal", "underscore"], function(postal, _) {
			return factory(postal, _, root, doc);
		});
	} else {
		// Browser globals
		factory(root.postal, root._, root, doc);
	}
}(this, document, function(postal, _, global, document, undefined) {

	// this returns a callback that, if invoked, removes the wireTap
	return postal.addWireTap(function(data, envelope) {
		var all = _.extend(envelope, { data: data });
		if(!JSON) {
			throw "This browser or environment does not provide JSON support";
		}
		try {
			console.log(JSON.stringify(all));
		}
		catch(exception) {
			try {
				all.data = "ERROR: " + exception.message;
				console.log(JSON.stringify(all));
			}
			catch(ex) {
				console.log("Unable to parse data to JSON: " + exception);
			}
		}
	});

}));