var localBus = {

	subscriptions: {},

	wireTaps: new Array(0),

	publish: function(envelope) {
		_.each(this.wireTaps,function(tap) {
			tap(envelope.data, envelope);
		});

		_.each(this.subscriptions[envelope.channel], function(topic) {
			_.each(topic, function(subDef){
				if(postal.configuration.resolver.compare(subDef.topic, envelope.topic)) {
					if(_.all(subDef.constraints, function(constraint) { return constraint(envelope.data,envelope); })) {
						if(typeof subDef.callback === 'function') {
							subDef.callback.apply(subDef.context, [envelope.data, envelope]);
							subDef.onHandled();
						}
					}
				}
			});
		});
	},

	subscribe: function(subDef) {
		var idx, found, fn, channel = this.subscriptions[subDef.channel], subs;

		if(!channel) {
			channel = this.subscriptions[subDef.channel] = {};
		}
		subs = this.subscriptions[subDef.channel][subDef.topic];
		if(!subs) {
			subs = this.subscriptions[subDef.channel][subDef.topic] = new Array(0);
		}

		idx = subs.length - 1;
		for(; idx >= 0; idx--) {
			if(subs[idx].priority <= subDef.priority) {
				subs.splice(idx + 1, 0, subDef);
				found = true;
				break;
			}
		}
		if(!found) {
			subs.unshift(subDef);
		}
		return subDef;
	},

	unsubscribe: function(config) {
		if(this.subscriptions[config.channel][config.topic]) {
			var len = this.subscriptions[config.channel][config.topic].length,
				idx = 0;
			for ( ; idx < len; idx++ ) {
				if (this.subscriptions[config.channel][config.topic][idx] === config) {
					this.subscriptions[config.channel][config.topic].splice( idx, 1 );
					break;
				}
			}
		}
	},

	addWireTap: function(callback) {
		var self = this;
		self.wireTaps.push(callback);
		return function() {
			var idx = self.wireTaps.indexOf(callback);
			if(idx !== -1) {
				self.wireTaps.splice(idx,1);
			}
		};
	}
};
