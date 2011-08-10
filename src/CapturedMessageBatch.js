var CapturedMessageBatch = function(batchId, description, messages) {
    this.batchId = "";
    this.description = description || "Captured Message Batch";
    this.messages = messages || [];
};