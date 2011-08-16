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
        _style = '.postal-replay-wrapper { font-family: Tahoma, Arial, sans-serif; font-size: 10pt; float: right; margin: 0px; padding: 0px; background-color: steelblue; color: white; text-align: center; border-radius: 3px; width: 300px; margin-top:40px; } .postal-replay-title { margin-top:3px; font-weight: bold; font-size: 11pt; } .postal-replay-dropdown { width: 150px; } #currentBatch { margin-top: 10px; margin-bottom: 10px; font-size: 10pt; font-weight: bold; display: none; } .postal-replay-label { width: 75px; float: left; text-align: right; margin-left: 5px; margin-right: 10px; } .postal-replay-value { text-align: left; } .info-msg { font-weight: bold; font-size: 11pt; line-height: 15pt; background-color: #191970; color: white; padding-left: 5px; padding-right: 5px; margin-left:5px; margin-right:5px;} .postal-replay-exit { margin-bottom:3px; }',
        _html = '<div class="postal-replay-title">Postal Message Replay</div> <input disabled class="postal-replay-button" type="button" id="btnRealTime" value="Play" onclick="postal.replay.replayRealTime()"> <input disabled class="postal-replay-button" type="button" id="btnStop" value="Stop" onclick="postal.replay.replayStop()"> <input disabled class="postal-replay-button" type="button" id="btnAdvance" value="Step" onclick="postal.replay.replayAdvance()"> <input disabled class="postal-replay-button" type="button" id="btnImmediate" value="Immediate" onclick="postal.replay.replayImmediate()"> <div class="postal-replay-load"> <select class="postal-replay-dropdown" id="drpBatches"></select> <input class="postal-replay-button" type="button" id="btnLoad" value="Load Batch" onclick="postal.replay.loadBatch()"> <div class="info-msg" id="info-msg"></div> </div> <div id="currentBatch"> <div class="postal-replay-row"> <div class="postal-replay-label">Batch ID:</div> <div class="postal-replay-value" id="batchId"></div> </div> <div class="postal-replay-row"> <div class="postal-replay-label">Description:</div> <div class="postal-replay-value" id="description"></div> </div> <div class="postal-replay-row"> <div class="postal-replay-label">Msg Count:</div> <div class="postal-replay-value" id="messageCount"></div> </div> </div> <input class="postal-replay-button postal-replay-exit" type="button" id="btnExitReplay" value="Exit Replay Mode" onclick="postal.replay.exitReplay()">';

    this.exitReplay = function() {
        var regex = /(postalmode=\w+)&*/i,
            match = regex.exec(window.location.hash);
        if(match && match.length >= 2) {
            window.location.hash = window.location.hash.replace(match[1], "postalmode=Normal");
        }
        else {
            postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.NORMAL_MODE });
        }   
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
        document.getElementById("currentBatch").style.display = "none";
        if(batchId) {
            postal.publish(postal.SYSTEM_EXCHANGE, "replay.store.loadBatch", { batchId: batchId });
            document.getElementById("info-msg").innerText = "";
        }
        else {
            document.getElementById("info-msg").innerText = "You must select a batch first";
        }
    };

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

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.store.batchLoaded", function(data) {
        document.getElementById("batchId").innerText = data.batchId;
        document.getElementById("description").innerText = data.description;
        document.getElementById("messageCount").innerText = data.msgCount;
        document.getElementById("currentBatch").style.display = "block";
        document.getElementById("btnRealTime").disabled = false;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnAdvance").disabled = false;
        document.getElementById("btnImmediate").disabled = false;
        document.getElementById("info-msg").innerText = "";
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

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.immediate", function() {
        document.getElementById("btnRealTime").disabled = true;
        document.getElementById("btnStop").disabled = false;
        document.getElementById("btnAdvance").disabled = true;
        document.getElementById("btnImmediate").disabled = true;
        document.getElementById("btnLoad").disabled = true;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.realTime", function() {
        document.getElementById("btnRealTime").disabled = true;
        document.getElementById("btnStop").disabled = false;
        document.getElementById("btnAdvance").disabled = true;
        document.getElementById("btnImmediate").disabled = true;
        document.getElementById("btnLoad").disabled = true;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.stop", function() {
        document.getElementById("btnRealTime").disabled = false;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnAdvance").disabled = false;
        document.getElementById("btnImmediate").disabled = false;
        document.getElementById("btnLoad").disabled = false;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.advanceNext", function() {
        document.getElementById("btnRealTime").disabled = true;
        document.getElementById("btnStop").disabled = false;
        document.getElementById("btnAdvance").disabled = true;
        document.getElementById("btnImmediate").disabled = true;
        document.getElementById("btnLoad").disabled = true;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.readyForNext", function() {
        document.getElementById("btnRealTime").disabled = false;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnAdvance").disabled = false;
        document.getElementById("btnImmediate").disabled = false;
        document.getElementById("btnLoad").disabled = false;
    });

    postal.subscribe(postal.SYSTEM_EXCHANGE, "replay.complete", function() {
        document.getElementById("btnRealTime").disabled = true;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnAdvance").disabled = true;
        document.getElementById("btnImmediate").disabled = true;
        document.getElementById("btnLoad").disabled = false;
    });
};

postal.replay = new ReplayPanel();


})(window);