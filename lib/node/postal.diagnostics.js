module.exports = function(postal) {
postal.addWireTap(function(data, envelope) {
    var all = _.extend(envelope, { data: data });
    if(!JSON) {
        throw "This browser or environment does provide JSON support";
    }
    try {
        console.log(JSON.stringify(all));
    }
    catch(exception) {
        try {
            all.data = exception;
            console.log(JSON.stringify(all));
        }
        catch(ex) {
            console.log("Unable to parse data to JSON: " + exception);
        }
    }
});
};