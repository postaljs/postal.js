postal.addWireTap(function(data) {
    try {
        console.log(JSON.stringify(data || {}));
    }
    catch(exception) {
        console.log("(Unable to show JSON data)");
    }
});