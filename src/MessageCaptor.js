var MessageCaptor = function(plugUp, unPlug) {
    var _grabMsg = function(data) {
            // We need to ignore system messages, since they could involve captures, replays, etc.
            if(data.exchange !== SYSTEM_EXCHANGE) {
                this.messages.push(data);
            }
        }.bind(this);

    plugUp(_grabMsg);

    this.messages = [];

    this.save = function(batchId, description) {
        unPlug(_grabMsg);
        var captureStore = amplify.store(POSTAL_MSG_STORE_KEY);
        if(!captureStore) {
            captureStore = {};
        }
        captureStore[batchId] = new CapturedMessageBatch(batchId, description, this.messages);
        amplify.store(POSTAL_MSG_STORE_KEY, captureStore);
    };

    postal.subscribe(SYSTEM_EXCHANGE, "captor.save", function(data) {
        this.save(data.batchId     || new Date().toString(),
                  data.description || "Captured Message Batch");
    }.bind(this));
};