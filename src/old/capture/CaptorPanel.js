var _subscriptions = [];

var CaptorPanel = function() {
    var _rendered = false,
        _style = '.align-right { float: right; } .postal-capture-wrapper { font-family: Tahoma, Arial, serif; font-size: 10pt; vertical-align: middle; margin: 0px; padding: 0px; background-color: steelblue; color: white; text-align: center; width: 280px; border-radius: 3px; margin-top:40px; } .postal-capture-exit-controls { margin-bottom: 3px; } .postal-capture-title { font-weight: bold; font-size: 11pt; text-align: center; margin-top: 3px; } .text-input { margin-left: 10px; } .info-msg { font-weight: bold; font-size: 11pt; line-height: 15pt; background-color: #191970; color: white; margin-left: 5px; margin-right: 5px; } #currentBatch { margin-top: 15px; margin-bottom: 15px; font-weight: bold; display: none; } #location { margin-left: 10px; } .postal-capture-label { width: 75px; float: left; text-align: right; margin-left: 5px; } .postal-batch-row { text-align: left; }',
        _html = '<div class="postal-capture-title">Postal Message Capture</div> <div> <input class="postal-capture-button" type="button" id="btnStart" value="Start" onclick="postal.capture.start()"> <input class="postal-capture-button" type="button" id="btnStop" value="Stop" onclick="postal.capture.stop()" disabled> <input class="postal-capture-button" type="button" id="btnReset" value="Reset/Clear" onclick="postal.capture.reset()" disabled> </div> <div class="" id="currentBatch"> <div class="postal-batch-row"> <div class="postal-capture-label">BatchId:</div><input class="text-input" type="text" id="batchId"> </div> <div class="postal-batch-row"> <div class="postal-capture-label">Description:</div><input class="text-input" type="description" id="description"> </div> <div class="postal-batch-row"> <div class="postal-capture-label">Location:</div><select id="location"><option value="local" selected="true">Local Storage</option></select> <input class="postal-capture-button" type="button" id="btnSave" value="Save" onclick="postal.capture.save()"> </div> <div class="info-msg" id="info-msg"></div> </div> <div class="postal-capture-exit-controls"> <input class="postal-capture-button postal-capture-exit" type="button" id="btnExitCapture" value="Exit Capture Mode" onclick="postal.capture.exitCapture()"> </div>';

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.batch.saved", function(batch) {
        document.getElementById("info-msg").innerHTML = "Saved Batch ID: " + batch.batchId + "<br>" + batch.msgCount + " message(s)" ;
        document.getElementById("info-msg").style.display = "block";
    }));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.stop", function(batch) {
        document.getElementById("currentBatch").style.display = "block";
        document.getElementById("btnStart").disabled = false;
        document.getElementById("btnStop").disabled = true;
        document.getElementById("btnReset").disabled = false;
        document.getElementById("btnExitCapture").disabled = false;
    }));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.reset", function(){
        document.getElementById("currentBatch").style.display = "none";
        document.getElementById("btnReset").disabled = true;
        document.getElementById("info-msg").innerText = "";
        document.getElementById("info-msg").style.display = "none";
        document.getElementById("btnExitCapture").disabled = false;
    }));

    _subscriptions.push(postal.subscribe(postal.SYSTEM_EXCHANGE, "captor.start", function(){
        document.getElementById("btnStart").disabled = true;
        document.getElementById("btnExitCapture").disabled = false;
        document.getElementById("btnStop").disabled = false;
        document.getElementById("btnReset").disabled = true;
        document.getElementById("info-msg").innerText = "";
        document.getElementById("info-msg").style.display = "none";
        document.getElementById("currentBatch").style.display = "none";
    }));

    this.start = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "captor.start");
    };

    this.stop = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "captor.stop");
    };

    this.reset = function() {
        postal.publish(postal.SYSTEM_EXCHANGE, "captor.reset");
    };

    this.save = function() {
        var batchId = document.getElementById("batchId").value,
            description = document.getElementById("description").value,
            cfg;
        if(batchId && description) {
            document.getElementById("info-msg").innerText = "";
            cfg = { batchId: batchId, description: description, location: "local" };
            postal.publish(postal.SYSTEM_EXCHANGE, "captor.save", cfg);
        }
        else {
            document.getElementById("info-msg").innerText = "BatchId and Description are Required";
            document.getElementById("info-msg").style.display = "block";
        }
    };

    this.exitCapture = function() {
        var regex = /(postalmode=\w+)&*/i,
            match = regex.exec(window.location.hash);
        if(match && match.length >= 2) {
            window.location.hash = window.location.hash.replace(match[1], "postalmode=Normal");
        }
        else {
            postal.publish(postal.SYSTEM_EXCHANGE, "mode.set", { mode: postal.NORMAL_MODE });
        }
    };

    this.render = function() {
        if(!_rendered){
            var style = document.createElement("style");
            style.innerText = _style;
            document.getElementsByTagName("head")[0].appendChild(style);

            var wrapper = document.createElement("div");
            wrapper.setAttribute("class", "align-right postal-capture-wrapper");
            wrapper.setAttribute("id", "capture-wrapper");
            wrapper.innerHTML = _html;
            document.body.appendChild(wrapper);
            _rendered = true;
        }
        else {
            document.getElementById("capture-wrapper").hidden = false;
        }
    };

    this.hide = function() {
        document.getElementById("capture-wrapper").hidden = true;
    };
};

postal.capture = new CaptorPanel();

