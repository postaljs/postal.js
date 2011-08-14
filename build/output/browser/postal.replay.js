/*
    postal.js
    Author: Jim Cowart
    License: Dual licensed MIT (http://www.opensource.org/licenses/mit-license) & GPL (http://www.opensource.org/licenses/gpl-license)
    Version 0.0.1
*/

(function(global, undefined) {

var _forEachKeyValue = function(object, callback) {
        for(var x in object) {
            if(object.hasOwnProperty(x)) {
                callback(x, object[x]);
            }
        }
    },
    _subscriptions = [];

var ReplayContext = function (bus) {
    var _batch,
        _continue = true,
        _loadMessages = function(batchId) {
            var msgStore = amplify.store(postal.POSTAL_MSG_STORE_KEY),
                targetBatch;

            if(msgStore[window.location.pathname] && msgStore[window.location.pathname][batchId]) {
                targetBatch = msgStore[window.location.pathname][batchId];
                targetBatch.messages.forEach(function(msg) {
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
            if(_batch) {
                while(_batch.messages.length > 0) {
                    if(_continue) {
                        _advanceNext();
                    }
                    else {
                        break;
                    }
                }
            }
        },
        _advanceNext = function() {
            if(_batch && _batch.messages.length > 0) {
                var msg = _batch.messages.shift();
                bus.publish(msg.exchange, msg.topic, msg.data);
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
                _forEachKeyValue(local[window.location.pathname], function(k, v) {
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
                        postal.replay.render();
                        return new ReplayContext(bus);
                      },
                      function(bus) {
                        postal.replay.hide();
                        _subscriptions.forEach(function(remove) { remove(); });
                      });

var ReplayPanel = function() {
    var _rendered = false,
        _style = '.postal-replay-wrapper { font-family: Tahoma, Arial; font-size: 10pt; float: left; vertical-align: middle; margin: 0px; padding: 0px; position: fixed; left: 0px; top: 0px; width: 100%; background-color: steelblue; color: white; } .postal-replay-title { float: left; margin-top: 4px; margin-left: 5px; margin-right: 15px; font-weight: bold; font-size: 11pt; height: 100%; } .postal-replay-button { float: left; } .postal-replay-dropdown { width: 150px; } .postal-replay-load { float: right; } .postal-replay-load select { float: left; margin-right: 10px; } #currentBatch { margin-top: 4px; margin-left: 20px; font-size: 10pt; font-weight: bold; float: left; } .postal-replay-exit { margin-left:35px; }',
        _html = '<div class="postal-replay-title">Postal Replay</div> <input class="postal-replay-button" type="button" id="btnRealTime" value="Play" alt="Real Time Playback" onclick="postal.replay.replayRealTime()"> <input class="postal-replay-button" type="button" id="btnStop" value="Stop" onclick="postal.replay.replayStop()"> <input class="postal-replay-button" type="button" id="btnAdvance" value="Step" alt="Advances to Next Msg (manual progression)" onclick="postal.replay.replayAdvance()"> <input class="postal-replay-button" type="button" id="btnImmediate" value="Immediate" alt="Replays all Messages Immediately" onclick="postal.replay.replayImmediate()"> <div id="currentBatch"></div> <div class="postal-replay-load"> <select class="postal-replay-dropdown" id="drpBatches"></select> <input class="postal-replay-button" type="button" id="btnLoad" value="Load Batch" onclick="postal.replay.loadBatch()"> <input class="postal-replay-button postal-replay-exit" type="button" id="btnExitReplay" value="Exit Replay Mode" onclick="postal.replay.exitReplay()"></div>';

    this.exitReplay = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.NORMAL_MODE });
    };

    this.replayRealTime = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.realTime");
    };

    this.replayImmediate = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.immediate");
    };

    this.replayAdvance = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.advanceNext");
    };

    this.replayStop = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.stop");
    };

    this.loadBatch = function() {
        var batchId = document.getElementById("drpBatches").value;
        postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.loadBatch", { batchId: batchId });
    };

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.batchLoaded", function(data) {
        var text = "Replaying: " + data.batchId + " (" + data.description + ") " + data.msgCount + " message(s)";
        document.getElementById("currentBatch").innerText = text;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.batchList", function(data) {
        var dropDown = document.getElementById("drpBatches"),
            optElem;
        dropDown.options.remove();
        if(data) {
            data.forEach(function(item) {
                optElem = document.createElement("option");
                optElem.value = item.batchId;
                optElem.text = item.batchId
                dropDown.options.add(optElem);
            });
        }
    });

    this.render = function() {
        if(!_rendered){
            var style = document.createElement("style");
            style.innerText = _style;
            document.getElementsByTagName("head")[0].appendChild(style);

            var wrapper = document.createElement("div");
            wrapper.setAttribute("class", "postal-replay-wrapper");
            wrapper.setAttribute("id", "replay-wrapper");
            wrapper.innerHTML = _html;
            document.body.appendChild(wrapper);
            _rendered = true;
        }
        else {
            document.getElementById("replay-wrapper").hidden = false;
        }
    };

    this.hide = function() {
        document.getElementById("replay-wrapper").hidden = true;
    };
};

postal.replay = new ReplayPanel();


})(window);