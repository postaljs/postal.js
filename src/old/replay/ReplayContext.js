var _subscriptions = [];

var ReplayContext = function (bus) {
    var _batch,
        _continue = true,
        _loadMessages = function(batchId) {
            var msgStore = amplify.store(postal.POSTAL_MSG_STORE_KEY),
                targetBatch;

            if(msgStore[window.location.pathname] && msgStore[window.location.pathname][batchId]) {
                targetBatch = msgStore[window.location.pathname][batchId];
                _.each(targetBatch.messages, function(msg) {
                    msg.timeStamp = new Date(msg.timeStamp);
                });
                _batch = msgStore[window.location.pathname][batchId];
                postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.batchLoaded", { batchId: batchId,
                                                                                     description: targetBatch.description,
                                                                                     msgCount: targetBatch.messages.length });
            }
        },
        _batchListCache = [],
        _remoteConfigured = false,
        _replayImmediate = function() {
            var skipComplete = false;
            if(_batch) {
                while(_batch.messages.length > 0) {
                    if(_continue) {
                        _advanceNext();
                    }
                    else {
                        skipComplete = true;
                        break;
                    }
                }
                if(!skipComplete) {
                    postal.publish(postal.SYSTEM_EXCHANGE, "replay.complete");
                }
            }
        },
        _advanceNext = function() {
            if(_batch && _batch.messages.length > 0) {
                var msg = _batch.messages.shift();
                bus.publish(msg.exchange, msg.topic, msg.data);
            }
            else if(_batch && _batch.messages.length === 0) {
                postal.publish(postal.SYSTEM_EXCHANGE, "replay.complete");
            }
        },
        _replayRealTime = function() {
            if(_continue && _batch && _batch.messages.length > 0) {
               if(_batch.messages.length > 1) {
                   var span = _batch.messages[1].timeStamp - _batch.messages[0].timeStamp;
                   _advanceNext();
                   setTimeout(_replayRealTime, span);
               }
               else {
                    _advanceNext();
                    postal.publish(postal.SYSTEM_EXCHANGE, "replay.complete");
               }
            }
        };

    this.init = function() {

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.immediate", function() {
            _continue = true;
            _replayImmediate();
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.advanceNext", function() {
            _continue = true;
            _advanceNext();
            postal.publish(postal.SYSTEM_EXCHANGE, "replay.readyForNext");
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.realTime", function() {
            _continue = true;
            _replayRealTime();
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.stop", function() {
            _continue = false;
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.loadBatch", function(data) {
            if(data.batchId) {
                _continue = false;
                _loadMessages(data.batchId);
            }
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.refreshLocal", function(data){
            var local = amplify.store(postal.POSTAL_MSG_STORE_KEY) || {},
                batches = [];
            if(local && local[window.location.pathname]) {
                _.each(local[window.location.pathname], function(v, k) {
                    batches.push({  batchId: v.batchId,
                                    description: v.description,
                                    messageCount: v.messages.length,
                                    source: "local"
                                 });
                });
            }
            _batchListCache = _batchListCache.filter(function(x) { return x.source !== "local"; })
                                             .concat(batches);
            postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.batchList", _batchListCache);
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.refreshRemote", function(data) {
            if(_remoteConfigured) {
                amplify.request("getRemoteCaptures", function(data) {
                    if(data.batches) {
                        _batchListCache = _batchListCache.filter(function(x) { return x.source !== 'remote'; });
                        _batchListCache = _batchListCache.concat(data.batches.map(function(x) {
                                                x.source = "remote";
                                                return x;
                                           }));
                        postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.batchList", _batchListCache);
                    }
                });
            }
        }));

        _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.remote.config", function(data) {
            if(amplify) {
                amplify.request.define("getRemoteCaptures", "ajax", {
                    "url": data.url,
                    "dataType": "json",
                    "type": data.method,
                    "contentType" : "application/json"
                });
                _remoteConfigured = true;
            }
            else {
                throw "Amplify.js is required in order to access remote captured batches."
            }
        }));

        postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.refreshLocal");
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.refreshRemote");
    };

    this.init();
};

// Adding replay functionality to the bus.....
postal.addBusBehavior(postal.REPLAY_MODE,
                      function(bus) {
                        if(postal.replay) {
                            postal.replay.render();
                        }
                        return new ReplayContext(bus);
                      },
                      function(bus) {
                        if(postal.replay) {
                            postal.replay.hide();
                        }
                        _.each(_subscriptions, function(remove) { remove(); });
                      });

