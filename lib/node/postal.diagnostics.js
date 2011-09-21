module.exports = function(postal) {
postal.addWireTap(function(data) {
    if(!JSON) {
        throw "This browser or environment does provide JSON support";
    }
    try {
        console.log(JSON.stringify(data));
    }
    catch(exception) {
        console.log("Unable to parse data to JSON: " + exception);
    }
});
};