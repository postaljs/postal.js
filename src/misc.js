var isArray = function(value) {
        var s = typeof value;
        if (s === 'object') {
            if (value) {
                if (typeof value.length === 'number' &&
                        !(value.propertyIsEnumerable('length')) &&
                        typeof value.splice === 'function') {
                    s = 'array';
                }
            }
        }
        return s === 'array';
    },
    slice = [].slice,
    DEFAULT_EXCHANGE = "/",
    SYSTEM_EXCHANGE = "postal",
    NORMAL_MODE = "Normal",
    CAPTURE_MODE = "Capture",
    REPLAY_MODE = "Replay",
    POSTAL_MSG_STORE_KEY = "postal.captured",
    _forEachKeyValue = function(object, callback) {
        for(var x in object) {
            if(object.hasOwnProperty(x)) {
                callback(x, object[x]);
            }
        }
    };

