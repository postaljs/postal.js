/**
 * Pavlov - Test framework-independent behavioral API
 *
 * version 0.3.0pre
 *
 * http://github.com/mmonteleone/pavlov
 *
 * Copyright (c) 2009-2011 Michael Monteleone
 * Licensed under terms of the MIT License (README.markdown)
 */
(function (global) {

    // ===========
    // = Helpers =
    // ===========

    var util = {
        /**
         * Iterates over an object or array
         * @param {Object|Array} object object or array to iterate
         * @param {Function} callback callback for each iterated item
         */
        each: function (object, callback) {
            if (typeof object === 'undefined' || typeof callback === 'undefined'
                || object === null || callback === null) {
                throw "both 'target' and 'callback' arguments are required";
            }
            var name,
                i = 0,
                length = object.length,
                value;

            if (length === undefined) {
                for (name in object) {
                    if (object.hasOwnProperty(name)) {
                        if (callback.call( object[name], name, object[name]) === false) {
                            break;
                        }
                    }
                }
            } else {
                for (value = object[0];
                    i < length && callback.call(value, i, value) !== false;
                    value = object[++i]) {
                }
            }

            return object;
        },
        /**
         * converts an array-like object to an array
         * @param {Object} array array-like object
         * @returns array
         */
        makeArray: function (array) {
            return Array.prototype.slice.call(array);
        },
        /**
         * returns whether or not an object is an array
         * @param {Object} obj object to test
         * @returns whether or not object is array
         */
        isArray: function (obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
        },
        /**
         * merges properties form one object to another
         * @param {Object} dest object to receive merged properties
         * @param {Object} src object containing properies to merge
         */
        extend: function (dest, src) {
            if (typeof dest === 'undefined' || typeof src === 'undefined' ||
                dest === null || src === null) {
                throw "both 'source' and 'target' arguments are required";
            }
            var prop;
            for (prop in src) {
                if (src.hasOwnProperty(prop)) {
                    dest[prop] = src[prop];
                }
            }
        },
        /**
         * Naive display serializer for objects which wraps the objects'
         * own toString() value with type-specific delimiters.
         * [] for array
         * "" for string
         * Does not currently go nearly detailed enough for JSON use,
         * just enough to show small values within test results
         * @param {Object} obj object to serialize
         * @returns naive display-serialized string representation of the object
         */
        serialize: function (obj) {
            if (typeof obj === 'undefined') {
                return "";
            } else if (Object.prototype.toString.call(obj) === "[object Array]") {
                return '[' + obj.toString() + ']';
            } else if (Object.prototype.toString.call(obj) === "[object Function]") {
                return "function()";
            } else if (typeof obj === "string") {
                return '"' + obj + '"';
            } else {
                return obj;
            }
        },
        /**
         * transforms a camel or pascal case string
         * to all lower-case space-separated phrase
         * @param {string} value pascal or camel-cased string
         * @returns all-lower-case space-separated phrase
         */
        phraseCase: function (value) {
            return value.replace(/([A-Z])/g, ' $1').toLowerCase();
        }
    };


    // ====================
    // = Example Building =
    // ====================

    var examples = [],
        currentExample,
        /**
         * Rolls up list of current and ancestors values for given prop name
         * @param {String} prop Name of property to roll up
         * @returns array of values corresponding to prop name
         */
        rollup = function (example, prop) {
            var items = [];
            while (example !== null) {
                items.push(example[prop]);
                example = example.parent;
            }
            return items;
        };

    /**
     * Example Class
     * Represents an instance of an example (a describe)
     * contains references to parent and nested examples
     * exposes methods for returning combined lists of before, after, and names
     * @constructor
     * @param {example} parent example to append self as child to (optional)
     */
    function Example(parent) {
        if (parent) {
            // if there's a parent, append self as nested example
            this.parent = parent;
            this.parent.children.push(this);
        } else {
            // otherwise, add this as a new root example
            examples.push(this);
        }

        this.children = [];
        this.specs = [];
    }
    util.extend(Example.prototype, {
        name: '',                           // name of this description
        parent: null,                       // parent example
        children: [],                       // nested examples
        specs: [],                          // array of it() tests/specs
        before: function () {},              // called before all contained specs
        after: function () {},               // called after all contained specs
        /**
         * rolls up this and ancestor's before functions
         * @returns array of functions
         */
        befores: function () {
            return rollup(this, 'before').reverse();
        },
        /**
         * Rolls up this and ancestor's after functions
         * @returns array of functions
         */
        afters: function () {
            return rollup(this, 'after');
        },
        /**
         * Rolls up this and ancestor's description names, joined
         * @returns string of joined description names
         */
        names: function () {
            return rollup(this, 'name').reverse().join(', ');
        }
    });



    // ==============
    // = Assertions =
    // ==============

    /**
     * AssertionHandler
     * represents instance of an assertion regarding a particular
     * actual value, and provides an api around asserting that value
     * against any of the bundled assertion handlers and custom ones.
     * @constructor
     * @param {Object} value A test-produced value to assert against
     */
    function AssertionHandler(value) {
        this.value = value;
    }

    /**
     * Appends assertion methods to the AssertionHandler prototype
     * For each provided assertion implementation, adds an identically named
     * assertion function to assertionHandler prototype which can run implementation
     * @param {Object} asserts Object containing assertion implementations
     */
    var addAssertions = function (asserts) {
        util.each(asserts, function (name, fn) {
            AssertionHandler.prototype[name] = function () {
                // implement this handler against backend
                // by pre-pending AssertionHandler's current value to args
                var args =  util.makeArray(arguments);
                args.unshift(this.value);

                // if no explicit message was given with the assertion,
                // then let's build our own friendly one
                if (fn.length === 2) {
                    args[1] = args[1] || 'asserting ' + util.serialize(args[0]) + ' ' + util.phraseCase(name);
                } else if (fn.length === 3) {
                    var expected = util.serialize(args[1]);
                    args[2] = args[2] || 'asserting ' + util.serialize(args[0]) + ' ' + util.phraseCase(name) + (expected ? ' ' + expected : expected);
                }

                fn.apply(this, args);
            };
        });
    };

    /**
     * Add default assertions
     */
    addAssertions({
        equals: function (actual, expected, message) {
            adapter.assert(actual == expected, message);
        },
        isEqualTo: function (actual, expected, message) {
            adapter.assert(actual == expected, message);
        },
        isNotEqualTo: function (actual, expected, message) {
            adapter.assert(actual != expected, message);
        },
        isStrictlyEqualTo: function (actual, expected, message) {
            adapter.assert(actual === expected, message);
        },
        isNotStrictlyEqualTo: function (actual, expected, message) {
            adapter.assert(actual !== expected, message);
        },
        isTrue: function (actual, message) {
            adapter.assert(actual, message);
        },
        isFalse: function (actual, message) {
            adapter.assert(!actual, message);
        },
        isNull: function (actual, message) {
            adapter.assert(actual === null, message);
        },
        isNotNull: function (actual, message) {
            adapter.assert(actual !== null, message);
        },
        isDefined: function (actual, message) {
            adapter.assert(typeof actual !== 'undefined', message);
        },
        isUndefined: function (actual, message) {
            adapter.assert(typeof actual === 'undefined', message);
        },
        pass: function (actual, message) {
            adapter.assert(true, message);
        },
        fail: function (actual, message) {
            adapter.assert(false, message);
        },
        isFunction: function(actual, message) {
            return adapter.assert(typeof actual === "function", message);
        },
        isNotFunction: function (actual, message) {
            return adapter.assert(typeof actual !== "function", message);
        },
        throwsException: function (actual, expectedErrorDescription, message) {
            // can optionally accept expected error message
            try {
                actual();
                adapter.assert(false, message);
            } catch (e) {
                // so, this bit of weirdness is basically a way to allow for the fact
                // that the test may have specified a particular type of error to catch, or not.
                // and if not, e would always === e.
                adapter.assert(e === (expectedErrorDescription || e), message);
            }
        }
    });


    // =====================
    // = pavlov Public API =
    // =====================


    /**
     * Object containing methods to be made available as public API
     */
    var api = {
        /**
         * Initiates a new Example context
         * @param {String} description Name of what's being "described"
         * @param {Function} fn Function containing description (before, after, specs, nested examples)
         */
        describe: function (description, fn) {
            if (arguments.length < 2) {
                throw "both 'description' and 'fn' arguments are required";
            }

            // capture reference to current example before construction
            var originalExample = currentExample;
            try {
                // create new current example for construction
                currentExample = new Example(currentExample);
                currentExample.name = description;
                fn();
            } finally {
                // restore original reference after construction
                currentExample = originalExample;
            }
        },

        /**
         * Sets a function to occur before all contained specs and nested examples' specs
         * @param {Function} fn Function to be executed
         */
        before: function (fn) {
            if (arguments.length === 0) {
                throw "'fn' argument is required";
            }
            currentExample.before = fn;
        },

        /**
         * Sets a function to occur after all contained tests and nested examples' tests
         * @param {Function} fn Function to be executed
         */
        after: function (fn) {
            if (arguments.length === 0) {
                throw "'fn' argument is required";
            }
            currentExample.after = fn;
        },

        /**
         * Creates a spec (test) to occur within an example
         * When not passed fn, creates a spec-stubbing fn which asserts fail "Not Implemented"
         * @param {String} specification Description of what "it" "should do"
         * @param {Function} fn Function containing a test to assert that it does indeed do it (optional)
         */
        it: function (specification, fn) {
            if (arguments.length === 0) {
                throw "'specification' argument is required";
            }
            if (fn) {
                if (fn.async) {
                    specification += " asynchronously";
                }
                currentExample.specs.push([specification, fn]);
            } else {
                // if not passed an implementation, create an implementation that simply asserts fail
                api.it(specification, function () {api.assert.fail('Not Implemented');});
            }
        },

        /**
         * wraps a spec (test) implementation with an initial call to pause() the test runner
         * The spec must call resume() when ready
         * @param {Function} fn Function containing a test to assert that it does indeed do it (optional)
         */
        async: function (fn) {
            var implementation = function () {
                adapter.pause();
                fn.apply(this, arguments);
            };
            implementation.async = true;
            return implementation;
        },

        /**
         * Generates a row spec for each argument passed, applying
         * each argument to a new call against the spec
         * @returns an object with an it() function for defining
         * function to be called for each of given's arguments
         * @param {Array} arguments either list of values or list of arrays of values
         */
        given: function () {
            if (arguments.length === 0) {
                throw "at least one argument is required";
            }
            var args = util.makeArray(arguments);
            if (arguments.length === 1 && util.isArray(arguments[0])) {
                args = args[0];
            }

            return {
                /**
                 * Defines a row spec (test) which is applied against each
                 * of the given's arguments.
                 */
                it: function (specification, fn) {
                    util.each(args, function () {
                        var arg = this;
                        api.it("given " + arg + ", " + specification, function () {
                            fn.apply(this, util.isArray(arg) ? arg : [arg]);
                        });
                    });
                }
            };
        },

        /**
         * Assert a value against any of the bundled or custom assertions
         * @param {Object} value A value to be asserted
         * @returns an AssertionHandler instance to fluently perform an assertion with
         */
        assert: function (value) {
            return new AssertionHandler(value);
        },

        /**
         * specifies test runner to synchronously wait
         * @param {Number} ms Milliseconds to wait
         * @param {Function} fn Function to execute after ms has
         * passed before resuming
         */
        wait: function (ms, fn) {
            if (arguments.length < 2) {
                throw "both 'ms' and 'fn' arguments are required";
            }
            adapter.pause();
            global.setTimeout(function () {
                fn();
                adapter.resume();
            }, ms);
        },

        /**
         * specifies test framework to pause test runner
         */
        pause: function () {
            adapter.pause();
        },

        /**
         * specifies test framework to resume test runner
         */
        resume: function () {
            adapter.resume();
        }
    };

    // extend api's assert function for easier access to
    // parameter-less assert.pass() and assert.fail() calls
    util.each(['pass', 'fail'], function (i, method) {
        api.assert[method] = function (message) {
            api.assert()[method](message);
        };
    });

    /**
     * Extends a function's scope
     * applies the extra scope to the function returns un-run new version of fn
     * inspired by Yehuda Katz's metaprogramming Screw.Unit
     * different in that new function can still accept all parameters original function could
     * @param {Function} fn Target function for extending
     * @param {Object} thisArg Object for the function's "this" to refer
     * @param {Object} extraScope object whose members will be added to fn's scope
     * @returns Modified version of original function with extra scope.  Can still
     * accept parameters of original function
     */
    var extendScope = function (fn, thisArg, extraScope) {

        // get a string of the fn's parameters
        var params = fn.toString().match(/\(([^\)]*)\)/)[1],
        // get a string of fn's body
            source = fn.toString().match(/^[^\{]*\{((.*\s*)*)\}/m)[1];

        // create a new function with same parameters and
        // body wrapped in a with(extraScope) { }
        fn = new Function (
            "extraScope" + (params ?  ", " + params : ""),
            "with(extraScope) {" + source + "}");

        // returns a fn wrapper which takes passed args,
        // pre-pends extraScope arg, and applies to modified fn
        return function () {
            var args = [extraScope];
            util.each(arguments,function () {
                args.push(this);
            });
            fn.apply(thisArg, args);
        };
    };

    /**
     * Top-level Specify method.  Declares a new pavlov context
     * @param {String} name Name of what's being specified
     * @param {Function} fn Function containing exmaples and specs
     */
    var specify = function (name, fn) {
        if (arguments.length < 2) {
            throw "both 'name' and 'fn' arguments are required";
        }
        examples = [];
        currentExample = null;

        // set the test suite title
        name += " Specifications";
        if (typeof document !== 'undefined') {
            document.title = name + ' - Pavlov - ' + adapter.name;
        }

        // run the adapter initiation
        adapter.initiate(name);

        if (specify.globalApi) {
            // if set to extend global api,
            // extend global api and run example builder
            util.extend(global, api);
            fn();
        } else {
            // otherwise, extend example builder's scope with api
            // and run example builder
            extendScope(fn, this, api)();
        }

        // compile examples against the adapter and then run them
        adapter.compile(name, examples)();
    };

    // ====================================
    // = Test Framework Adapter Interface =
    // ====================================

    // abstracts functionality of underlying testing framework
    var adapter = {
        /**
         * adapter-specific initialization code
         * which is called once before any tests are run
         * @param {String} suiteName name of the pavlov suite name
         */
        initiate: function (suiteName) { },
        /**
         * adapter-specific assertion method
         * @param {bool} expr Boolean expression to assert against
         * @param {String} message message to pass along with assertion
         */
        assert: function (expr, message) {
            throw "'assert' must be implemented by a test framework adapter";
        },
        /**
         * adapter-specific compilation method.  Translates a nested set of
         * pre-constructed Pavlov example objects into a callable function which, when run
         * will execute the tests within the backend test framework
         * @param {String} suiteName name of overall test suite
         * @param {Array} examples Array of example object instances, possibly nesteds
         */
        compile: function (suiteName, examples) {
            throw "'compile' must be implemented by a test framework adapter";
        },
        /**
         * adapter-specific pause method.  When an adapter implements,
         * allows for its test runner to pause its execution
         */
        pause: function () {
            throw "'pause' not implemented by current test framework adapter";
        },
        /**
         * adapter-specific resume method.  When an adapter implements,
         * allows for its test runner to resume after a pause
         */
        resume: function () {
            throw "'resume' not implemented by current test framework adapter";
        }
    };


    // =====================
    // = Expose Public API =
    // =====================

    // add global settings onto pavlov
    global.pavlov = {
        version: '0.3.0pre',
        specify: specify,
        adapter: adapter,
        adapt: function (frameworkName, testFrameworkAdapter) {
            if ( typeof frameworkName === "undefined" ||
                typeof testFrameworkAdapter === "undefined" ||
                frameworkName === null ||
                testFrameworkAdapter === null) {
                throw "both 'frameworkName' and 'testFrameworkAdapter' arguments are required";
            }
            adapter.name = frameworkName;
            util.extend(adapter, testFrameworkAdapter);
        },
        util: {
            each: util.each,
            extend: util.extend
        },
        api: api,
        globalApi: false,                 // when true, adds api to global scope
        extendAssertions: addAssertions   // function for adding custom assertions
    };
}(window));


// =========================
// = Default QUnit Adapter =
// =========================

(function () {
    if (typeof QUnit === 'undefined') { return; }

    pavlov.adapt("QUnit", {
        initiate: function (name) {
            var addEvent = function (elem, type, fn) {
                if (elem.addEventListener) {
                    elem.addEventListener(type, fn, false);
                } else if (elem.attachEvent) {
                    elem.attachEvent("on" + type, fn);
                }
            };

            // after suite loads, set the header on the report page
            addEvent(window,'load',function () {
                // document.getElementsByTag('h1').innerHTML = name;
                var h1s = document.getElementsByTagName('h1');
                if (h1s.length > 0) {
                    h1s[0].innerHTML = name;
                }
            });
        },
        /**
         * Implements assert against QUnit's `ok`
         */
        assert: function (expr, msg) {
            ok(expr, msg);
        },
        /**
         * Implements pause against QUnit's stop()
         */
        pause: function () {
            stop();
        },
        /**
         * Implements resume against QUnit's start()
         */
        resume: function () {
            start();
        },
        /**
         * Compiles nested set of examples into flat array of QUnit statements
         * returned bound up in a single callable function
         * @param {Array} examples Array of possibly nested Example instances
         * @returns function of which, when called, will execute all translated QUnit statements
         */
        compile: function (name, examples) {
            var statements = [],
                each = pavlov.util.each;

            /**
             * Comples a single example and its children into QUnit statements
             * @param {Example} example Single example instance
             * possibly with nested instances
             */
            var compileDescription = function (example) {

                // get before and after rollups
                var befores = example.befores(),
                    afters = example.afters();

                // create a module with setup and teardown
                // that executes all current befores/afters
                statements.push(function () {
                    module(example.names(), {
                        setup: function () {
                            each(befores, function () { this(); });
                        },
                        teardown: function () {
                            each(afters, function () { this(); });
                        }
                    });
                });

                // create a test for each spec/"it" in the example
                each(example.specs, function () {
                    var spec = this;
                    statements.push(function () {
                        test(spec[0],spec[1]);
                    });
                });

                // recurse through example's nested examples
                each(example.children, function () {
                    compileDescription(this);
                });
            };

            // compile all root examples
            each(examples, function () {
                compileDescription(this, statements);
            });

            // return a single function which, when called,
            // executes all qunit statements
            return function () {
                each(statements, function () { this(); });
            };
        }
    });

    pavlov.extendAssertions({
        /**
         * Asserts two objects are deeply equivalent, proxying QUnit's deepEqual assertion
         */
        isSameAs: function (actual, expected, message) {
            deepEqual(actual, expected, message);
        },
        /*
         * Asserts two objects are deeply in-equivalent, proxying QUnit's notDeepEqual assertion
         */
        isNotSameAs: function (actual, expected, message) {
            notDeepEqual(actual, expected, message);
        }
    });

    // alias pavlov.specify as QUnit.specify for legacy support
    QUnit.specify = pavlov.specify;
    pavlov.util.extend(QUnit.specify, pavlov);
}());
