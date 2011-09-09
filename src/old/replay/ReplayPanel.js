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

