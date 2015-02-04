var minDash = {
    after: function(n, func) {
        n = Number.isFinite(n = +n) ? n : 0;
        return function() {
            if (--n < 1) {
                return func.apply(this, arguments);
            }
        };
    },
    any: function(array, predicate) {
        var index = -1, length = array.length;

        while (++index < length) {
            if (predicate(array[index], index, array)) {
                return true;
            }
        }
        return false;
    },
    bind: function(func, thisArg, arg) {
        return func.bind(thisArg, arg);
    },
    clone: function(obj) {
        if(obj === null || typeof(obj) !== "object") {
            return obj;
        }

        var temp = obj.constructor(); // changed

        for(var key in obj) {
            if(obj.hasOwnProperty(key)) {
                temp[key] = minDash.clone(obj[key]);
            }
        }
        return temp;
    },
    debounce: function(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this;
            var args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) {
                func.apply(context, args);
            }
        };
    },
    each: function(item, func) {
        if (Array.isArray(item)) {
            return item.forEach(func);
        } else {
            for(var key in item) {
                if (item.hasOwnProperty(key)) {
                    func(item[key], key);
                }
            }
        }
    },
    filter: function(arr, func) {
        return arr.filter(func);
    },
    isArray: function(arr) {
        return Array.isArray(arr);
    },
    isEmpty: function(value) {
        if (value === null) {
            return true;
        }
        return !Object.keys(value).length;
    },
    isEqual: function(x, y) {
        if ( x === y ) {
            return true;
        }

        if ( ! ( x instanceof Object ) || ! ( y instanceof Object ) ) {
            return false;
        }

        if ( x.constructor !== y.constructor ) {
            return false;
        }

        for ( var p in x ) {
            if ( ! x.hasOwnProperty( p ) ) {
                continue;
            }

            if ( ! y.hasOwnProperty( p ) ) {
                return false;
            }

            if ( x[ p ] === y[ p ] ) {
                continue;
            }

            if ( typeof( x[ p ] ) !== "object" ) {
                return false;
            }

            if ( ! minDash.isEqual( x[ p ],  y[ p ] ) ) {
                return false;
            }
        }

        for ( p in y ) {
            if ( y.hasOwnProperty( p ) && ! x.hasOwnProperty( p ) ) {
                return false;
            }
        }

        return true;
    },
    isFunction: function(value) {
        return typeof value === "function" || false;
    },
    isNumber: function(value) {
        return typeof value === "number" && Number.isFinite(value);
    },
    isObject: function(value) {
        return value !== null && typeof value === "object";
    },
    isString: function(value) {
        return value !== null && typeof value === "string";
    },
    map: function(arr, func) {
        return arr.map(func);
    },
    throttle: function(fn, time) {
        var last, deferTimer;
        return function () {
            var now = +new Date();
            var args = arguments;
            if (last && now < last + time) {
                // hold on to it
                clearTimeout(deferTimer);
                deferTimer = setTimeout(function () {
                    last = now;
                    fn.apply(this, args);
                }, time);
            } else {
                last = now;
                fn.apply(this, args);
            }
        };
    },
    extend: function(object, source) {
        var props = Object.keys(source);
        if (!props) {
            props = object;
            object = {};
        }
        var index = -1;
        var length = props.length;

        while (++index < length) {
            var key = props[index];
            object[key] = source[key];
        }
        return object;
    },
};
