/* global postal */
describe.only( "postal.minDash", function() {
    var minDash;
    before(function() {
        minDash = postal.configuration.minDash;
    });
	describe( "When calling minDash.after", function() {
        it( "should return expected results after 3 calls", function() {
            var res, i, fn;
            // create function
            fn = minDash.after(3, function() {
                return true;
            });
            // call and check
            for (i = 0; i < 3; i++) {
                res = fn();
                if (i === 2) {
                    res.should.be.true;
                } else {
                    ( typeof res === "undefined" ).should.be.ok;
                }
            }
        });
    });
    describe( "When calling minDash.any", function() {
        var data;
        before(function() {
            data = ["one", "two", "three", "four"];
        });
        it( "should return true for one matching item", function() {
            var res = minDash.any(data, function(val) {
                return val === "three";
            });
            res.should.be.true;
        });
        it( "should return nothing", function() {
            var res = minDash.any(data, function(val, key) {
                return val === "i'm not there";
            });
            res.should.be.false;
        });
    });
    describe( "When calling minDash.bind", function() {
        var initialFn;
        before(function() {
            initialFn = function(word, num) {
                return "Test" + word + " " + num;
            };
        });
        it( "should create new function", function() {
            var newFn = minDash.bind(initialFn, this, "_test");
            var res = newFn(10);
            res.should.equal("Test_test 10");
        });
    });
    describe( "When calling minDash.clone", function() {
        var initialObj;
        before(function() {
            initialObj = {
                level1: {
                    level2: {
                        level3: "test"
                    }
                }
            };
        });
        it( "should deep copy object", function() {
            var newObj = minDash.clone(initialObj);
            // check copy
            newObj.level1.level2.level3.should.equal("test");
            // modify original
            initialObj.level1.level2.level3 = "changed";
            // verify that copy is unchanged
            newObj.level1.level2.level3.should.equal("test");
        });
    });
    describe( "When calling minDash.debounce", function() {
        var initialFn, data, timeout;
        before(function() {
            data = "init";
            initialFn = function() {
                data = "changed";
            };
            timeout = 500;
        });
        it( "should call function after timeout", function(done) {
            var newObj = minDash.debounce(initialFn, timeout);
            // trigger
            newObj();
            // check that data is still same
            data.should.equal("init");
            // wait for timeout
            setTimeout(function() {
                // check that data is changed
                data.should.equal("changed");
                done();
            }, timeout);
        });
    });
    describe( "When calling minDash.each", function() {
        var dataArr, dataObj;
        before(function() {
            dataArr = [1, 2, 3, 4];
            dataObj = {
                key1: "val1",
                key2: "val2",
                key3: "val3",
            };
        });
        it( "should iterate over array", function() {
            minDash.each(dataArr, function(val, key) {
                val.should.be.a.Number;
                key.should.be.a.Number;
                dataArr[key].should.equal(val);
            });
        });
        it( "should iterate over object", function() {
            minDash.each(dataObj, function(val, key) {
                key.should.be.a.String;
                val.should.be.a.String;
                dataObj[key].should.equal(val);
            });
        });
    });
    describe( "When calling minDash.filter", function() {
        var data;
        before(function() {
            data = [1, 2, 3, 4];
        });
        it( "should filter array", function() {
            var newArr = minDash.filter(data, function(val) {
                return val % 2 === 0;
            });
            newArr.length.should.equal(2);
            newArr[0].should.equal(2);
            newArr[1].should.equal(4);
        });
    });
    describe( "When calling minDash.isArray", function() {
        it( "should return true when array", function() {
            var res = minDash.isArray([1, 2, 3]);
            res.should.be.true;
        });
        it( "should return false when not array", function() {
            var res = minDash.isArray({test: "data"});
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isEmpty", function() {
        it( "should return true when value is empty", function() {
            // check null
            var res = minDash.isEmpty(null);
            res.should.be.true;
            // check 0 length array
            res = minDash.isEmpty([]);
            res.should.be.true;
            // check empty object
            res = minDash.isEmpty({});
            res.should.be.true;
        });
        it( "should return false when value is not empty", function() {
            // check non-empty object
            var res = minDash.isEmpty({test: "data"});
            res.should.be.false;
            // check non-empty array
            res = minDash.isEmpty([1, 2, 3]);
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isEqual", function() {
        var data, dataEq, dataNonEq;
        before(function() {
            data = {
                test: "data",
                equal: "123",
                deep: {
                    object: "data"
                }
            };
            dataEq = {
                test: "data",
                equal: "123",
                deep: {
                    object: "data"
                }
            };
            dataNonEq = {
                test: "data",
                equal: "123",
                deep: {
                    object: "data",
                    other: "thing"
                }
            };
        });
        it( "should return true when values are equal", function() {
            var res = minDash.isEqual(data, dataEq);
            res.should.be.true;
        });
        it( "should return false when values are not equal", function() {
            var res = minDash.isEqual(data, dataNonEq);
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isFunction", function() {
        it( "should return true when function", function() {
            var res = minDash.isFunction(function() {});
            res.should.be.true;
        });
        it( "should return false when not function", function() {
            var res = minDash.isFunction({test: "data"});
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isNumber", function() {
        it( "should return true when number", function() {
            var res = minDash.isNumber(123);
            res.should.be.true;
        });
        it( "should return false when not number", function() {
            var res = minDash.isNumber({test: "data"});
            res.should.be.false;
            res = minDash.isNumber("123");
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isObject", function() {
        it( "should return true when object", function() {
            var res = minDash.isObject({test: "data"});
            res.should.be.true;
        });
        it( "should return false when not object", function() {
            var res = minDash.isObject(function() {});
            res.should.be.false;
            res = minDash.isObject("123");
            res.should.be.false;
            res = minDash.isObject(123);
            res.should.be.false;
        });
    });
    describe( "When calling minDash.isString", function() {
        it( "should return true when string", function() {
            var res = minDash.isString("data");
            res.should.be.true;
        });
        it( "should return false when not string", function() {
            var res = minDash.isString(function() {});
            res.should.be.false;
            res = minDash.isString({});
            res.should.be.false;
            res = minDash.isString(123);
            res.should.be.false;
        });
    });
    describe( "When calling minDash.map", function() {
        var data;
        before(function() {
            data = [1, 2, 3];
        });
        it( "should map over array", function() {
            var res = minDash.map(data, function(val) {
                return val + 1;
            });
            res.length.should.equal(3);
            res.forEach(function(item, index) {
                item.should.equal(data[index] + 1);
            });
        });
    });
    describe( "When calling minDash.throttle", function() {
        var data, initialFn, delay;
        before(function() {
            delay = 300;
            data = [];
            initialFn = function() {
                data.push(1);
            };
        });
        it( "should throttle function", function(done) {
            var resFn = minDash.throttle(initialFn, delay);
            // call 5 times
            for(var i = 0; i < 5; i++) {
                resFn();
            }
            // check result
            setTimeout(function() {
                data.length.should.equal(2);
                done();
            }, delay);
        });
    });
    describe( "When calling minDash.extend", function() {
        var data, extend;
        before(function() {
            data = {
                key1: "val1",
                key2: "val2"
            };
            extend = {
                key3: "val3",
                key4: "val4"
            };
        });
        it( "should extend object", function() {
            var res = minDash.extend(data, extend);
            Object.keys(res).length.should.equal(4);
            res.key3.should.equal(extend.key3);
            res.key4.should.equal(extend.key4);
        });
    });
});
