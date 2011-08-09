if(!Object.prototype.forEach) {
    Object.prototype.forEach = function (callback) {
        var self = this;
        for(var x in self) {
            if(self.hasOwnProperty(x)) {
                callback(self[x]);
            }
        }
    };
};

if(!Object.prototype.forEachKeyValue) {
    Object.prototype.forEachKeyValue = function (callback) {
        var self = this;
        for(var x in self) {
            if(self.hasOwnProperty(x)) {
                callback(x, self[x]);
            }
        }
    };
};

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
};

var slice = [].slice;