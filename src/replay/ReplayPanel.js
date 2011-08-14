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

