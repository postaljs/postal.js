QUnit.specify("postal.js", function(){
    describe("LanguageExtensions", function(){
        describe("Object forEach extension", function() {
            describe("When testing an empty object", function() {
                var emptyObj = {};
                var counter = 0;
                var testClosure = function() {
                    counter++;
                };

                it("should not invoke the callback when no members exist to iterate over", function(){
                    emptyObj.forEach(testClosure);
                    assert(counter).equals(0);
                });
            });
            describe("When testing an object with one member", function() {
                var emptyObj = { test: "Test Value"};
                var counter = 0;
                var testClosure = function() {
                    counter++;
                };

                it("should invoke the callback once", function(){
                    emptyObj.forEach(testClosure);
                    assert(counter).equals(1);
                });
            });
            describe("When testing an object with two members", function() {
                var emptyObj = { test: "Test Value", other: "Moar"};
                var counter = 0;
                var testClosure = function() {
                    counter++;
                };

                it("should invoke the callback twice", function(){
                    emptyObj.forEach(testClosure);
                    assert(counter).equals(2);
                });
            });
        });
    });
});