var localBus = {

	subscriptions: {},

	wireTaps: new Array(0),

	publish: function(data, envelope) {
		_.each(this.wireTaps,function(tap) {
			tap(data, envelope);
		});

		_.each(this.subscriptions[envelope.channel], function(topic) {
			_.each(topic, function(binding){
				if(postal.configuration.resolver.compare(binding.topic, envelope.topic)) {
					if(_.all(binding.constraints, function(constraint) { return constraint(data); })) {
						if(typeof binding.callback === 'function') {
							binding.callback.apply(binding.context, [data, envelope]);
							binding.onHandled();
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
