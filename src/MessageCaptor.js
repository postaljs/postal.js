var MessageCaptor = function(bus) {
    var _grabMsg = function(data) {
            // We need to ignore system messages, since they could involve captures, replays, etc.
            if(data.exchange !== SYSTEM_EXCHANGE) {
                this.messages.push(data);
            }
        }.bind(this),
        _remoteConfigured = false;

    this.plugUp = function() {
        bus.wireTaps.push(_grabMsg);
    };

    this.unPlug = function(callback) {
        var idx = bus.wireTaps.indexOf(callback);
        if(idx !== -1) {
            bus.wireTaps.splice(idx,1);
        }
    };

    this.messages = [];

    this.save = function(location, batchId, description) {
        this.unPlug(_grabMsg);
        var batch = {
                        batchId: batchId,
                        description: description,
                        messages: this.messages
                    };
        if(location === 'remote') {
            amplify.request("saveRemoteCapture", batch, function(data) {
                postal.publish(SYSTEM_EXCHANGE, "replay.store.refreshRemote");
            });
        }
        else {
            var captureStore = amplify.store(POSTAL_MSG_STORE_KEY);
            if(!captureStore) {
                captureStore = {};
            }
            if(!captureStore[window.location.pathname]) {
                captureStore[window.location.pathname] = {};
            }
            captureStore[window.location.pathname][batchId] = batch;
            amplify.store(POSTAL_MSG_STORE_KEY, captureStore);
            postal.publish(SYSTEM_EXCHANGE, "replay.store.refreshLocal");
        }
    };

    this.plugUp();

    postal.subscribe(SYSTEM_EXCHANGE, "captor.save", function(data) {
        this.save(data.location    || "local",
                  data.batchId     || new Date().toString(),
                  data.description || "Captured Message Batch");
    }.bind(this));

    postal.subscribe(SYSTEM_EXCHANGE, "captor.remote.config", function(data) {
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
        });
};

// Adding replay functionality to the bus.....
postal.addBusBehavior(CAPTURE_MODE, function(bus) { return new MessageCaptor(bus); });
