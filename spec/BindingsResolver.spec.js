QUnit.specify("postal.js", function(){
    describe("bindingsResolver", function(){
        describe("When calling regexify", function() {
            describe("With a topic containing no special escape chars", function() {
                var result = bindingsResolver.regexify("CoolTopic");
                console.log(result);
                it("Should equal 'CoolTopic'", function(){
                    assert(result).equals("CoolTopic");
                });
            });
            describe("With a topic containing periods", function() {
                var result = bindingsResolver.regexify("Top.Middle.Bottom");
                console.log(result);
                it("Only the periods should be escaped", function(){
                    assert(result).equals("Top\\.Middle\\.Bottom");
                });
            });
            describe("With a topic containing a hash", function() {
                var result = bindingsResolver.regexify("Top#Bottom");
                console.log(result);
                it("Only the hash should be escaped", function(){
                    assert(result).equals("Top[A-Z,a-z,0-9]*Bottom");
                });
            });
            describe("With a topic containing a hash and periods", function() {
                var result = bindingsResolver.regexify("Top.#.Bottom");
                console.log(result);
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top\\.[A-Z,a-z,0-9]*\\.Bottom");
                });
            });
            describe("With a topic containing a hash and asterisk", function() {
                var result = bindingsResolver.regexify("Top#Bottom*");
                console.log(result);
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top[A-Z,a-z,0-9]*Bottom.*");
                });
            });
            describe("With a topic containing a hash, asterisk and periods", function() {
                var result = bindingsResolver.regexify("Top.#.Bottom.*");
                console.log(result);
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top\\.[A-Z,a-z,0-9]*\\.Bottom\\..*");
                });
            });
            describe("With a topic containing an asterisk and periods", function() {
                var result = bindingsResolver.regexify("Top.*.Bottom");
                console.log(result);
                it("The asterisk should be escaped", function(){
                    assert(result).equals("Top\\..*\\.Bottom");
                });
            });
        });
    });
});