var ReplayContext = function (publish, subscribe) {
    var _batch,
        _continue = true,
        _loadMessages = function(batchId) {
            var msgStore = amplify.store(POSTAL_MSG_STORE_KEY),
                targetBatch = msgStore[batchId];
            if(targetBatch) {
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
            var lastTime = _batch.messages[0].timeStamp;
            while(_batch.messages.length > 0) {
                if(_continue) {
                    _advanceNext();
                    setTimeout(publish(SYSTEM_EXCHANGE, "replay.realTime"), _batch.messages[0].timeStamp - lastTime);
                }
                else {
                    break;
                }
            }
        };

    subscribe(SYSTEM_EXCHANGE, "replay.load", function(data) {
        _continue = false;
        _loadMessages(data);
    });

    subscribe(SYSTEM_EXCHANGE, "replay.immediate", function() {
        _continue = true;
        _replayImmediate();
    });

    subscribe(SYSTEM_EXCHANGE, "replay.advanceNext", function() {
        _continue = true;
        _advanceNext();
    });

    subscribe(SYSTEM_EXCHANGE, "replay.realTime", function() {
        _continue = true;
        _replayRealTime();
    });

    subscribe(SYSTEM_EXCHANGE, "replay.stop", function() {
        _continue = false;
    });
};