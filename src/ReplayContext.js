var ReplayContext = function (publish, subscribe) {
    var _batch,
        _continue = true,
        _loadMessages = function(batchId) {
            var msgStore = amplify.store(POSTAL_MSG_STORE_KEY),
                targetBatch = msgStore[batchId];
            if(targetBatch) {
                targetBatch.messages.forEach(function(msg) {
                    msg.timeStamp = new Date(msg.timeStamp);
                });
                _batch = targetBatch;
            }
        },
        _replayImmediate = function() {
            while(_batch.messages.length > 0) {
                if(_continue) {
                    _advanceNext();
                }
                else {
                    break;
                }
            }
        },
        _advanceNext = function() {
            var msg = _batch.messages.shift();
            publish(msg.exchange, msg.topic, msg.data);
        },
        _replayRealTime = function() {
            if(_continue && _batch.messages.length > 0) {
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

    postal.subscribe(SYSTEM_EXCHANGE, "replay.load", function(data) {
        _continue = false;
        _loadMessages(data);
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.immediate", function() {
        _continue = true;
        _replayImmediate();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.advanceNext", function() {
        _continue = true;
        _advanceNext();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.realTime", function() {
        _continue = true;
        _replayRealTime();
    });

    postal.subscribe(SYSTEM_EXCHANGE, "replay.stop", function() {
        _continue = false;
    });
};

