var _subscriptions = [],
    _hashCheck = function() {
        var hash = window.location.hash
    };

var MessageCaptor = function(bus) {
    var _grabMsg = function(data) {
            // We need to ignore system messages, since they could involve captures, replays, etc.
            if(data.exchange !== postal.SYSTEM_EXCHANGE) {
                this.messages.push(data);
            }
        }.bind(this),
        _remoteConfigured = false,
        _removeWireTap;

    this.plugUp = function() {
        _removeWireTap = postal.addWireTap(_grabMsg);
    };

    this.unPlug = function(callback) {
        _removeWireTap();
    };

    this.messages = [];

    this.save = function(location, batchId, description) {
        var batch = {
                        batchId: batchId,
                        description: description,
                        messages: this.messages
                    };
        if(location === 'remote') {
            amplify.request("saveRemoteCapture", batch, function(data) {
                postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.refreshRemote");
            });
        }
        else {
            var captureStore = amplify.store(postal.POSTAL_MSG_STORE_KEY);
            if(!captureStore) {
                captureStore = {};
            }
            if(!captureStore[window.location.pathname]) {
                captureStore[window.location.pathname] = {};
            }
            captureStore[window.location.pathname][batchId] = batch;
            amplify.store(postal.POSTAL_MSG_STORE_KEY, captureStore);
            postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.refreshLocal");
        }
        postal.publish(postal.SYSTEM_EXCHANGE, "captor.batch.saved", { batchId: batch.batchId,
                                                                       description: batch.description,
                                                                       msgCount: batch.messages.length });
    };

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.start", function() {
        this.plugUp();
    }.bind(this)));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.stop", function() {
        this.unPlug(_grabMsg);
    }.bind(this)));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.reset", function() {
        this.messages = [];
    }.bind(this)));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.save", function(data) {
        this.save(data.location    || "local",
                  data.batchId     || new Date().toString(),
                  data.description || "Captured Message Batch");
    }.bind(this)));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.remote.config", function(data) {
        if(amplify) {
            amplify.request.define("saveRemoteCapture", "ajax", {
                "url": data.url,
                "dataType": "json",
                "type": data.method,
                "contentType" : "application/json"
            });
            _remoteConfigured = true;
        }
        else {
            throw "Amplify.js is required in order to save captured batches to a remote location."
        }
    }));
};

// Adding capture functionality to the bus.....
postal.addBusBehavior(postal.CAPTURE_MODE,
                      function(bus) {
                        if(postal.capture) {
                          postal.capture.render();
                        }

                        var captor = new MessageCaptor(bus);
                        postal.publish(postal.SYSTEM_EXCHANGE, "captor.start");
                        return captor;
                      },
                      function(bus) {
                        if(postal.capture) {
                            postal.capture.hide();
                        }
                        _.each(_subscriptions, function(remove) { remove(); });
                      });

