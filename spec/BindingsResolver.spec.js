QUnit.specify("postal.js", function(){
    describe("bindingsResolver", function(){
        describe("When calling regexify", function() {
            describe("With a topic containing no special escape chars", function() {
                var result = bindingsResolver.regexify("CoolTopic");
                it("Should equal 'CoolTopic'", function(){
                    assert(result).equals("CoolTopic");
                });
            });
            describe("With a topic containing periods", function() {
                var result = bindingsResolver.regexify("Top.Middle.Bottom");
                it("Only the periods should be escaped", function(){
                    assert(result).equals("Top\\.Middle\\.Bottom");
                });
            });
            describe("With a topic containing a hash", function() {
                var result = bindingsResolver.regexify("Top#Bottom");
                it("Only the hash should be escaped", function(){
                    assert(result).equals("Top[A-Z,a-z,0-9]*Bottom");
                });
            });
            describe("With a topic containing a hash and periods", function() {
                var result = bindingsResolver.regexify("Top.#.Bottom");
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top\\.[A-Z,a-z,0-9]*\\.Bottom");
                });
            });
            describe("With a topic containing a hash and asterisk", function() {
                var result = bindingsResolver.regexify("Top#Bottom*");
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top[A-Z,a-z,0-9]*Bottom.*");
                });
            });
            describe("With a topic containing a hash, asterisk and periods", function() {
                var result = bindingsResolver.regexify("Top.#.Bottom.*");
                it("The hash should be escaped for alphanumeric regex", function(){
                    assert(result).equals("Top\\.[A-Z,a-z,0-9]*\\.Bottom\\..*");
                });
            });
            describe("With a topic containing an asterisk and periods", function() {
                var result = bindingsResolver.regexify("Top.*.Bottom");
                it("The asterisk should be escaped", function(){
                    assert(result).equals("Top\\..*\\.Bottom");
                });
            });
        });
        describe("When calling compare", function(){
            describe("With topic Top.Middle.Bottom and binding Top.Middle.Bottom", function(){
                var result = bindingsResolver.compare("Top.Middle.Bottom", "Top.Middle.Bottom"),
                    cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.Middle.Bottom"];
                it("Result should be true", function() {
                    assert(result).isTrue();
                });
                it("Should create a resolver cache entry", function(){
                    assert(cached).isTrue();
                });
            });
            describe("With topic Top.Middle.Bottom and binding Top.#.Bottom", function(){
                var result = bindingsResolver.compare("Top.#.Bottom", "Top.Middle.Bottom"),
                    cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.#.Bottom"];
                it("Result should be true", function() {
                    assert(result).isTrue();
                });
                it("Should create a resolver cache entry", function(){
                    assert(cached).isTrue();
                });
            });
            describe("With topic Top.Middle.Bottom and binding Top.*.Bottom", function(){
                var result = bindingsResolver.compare("Top.*.Bottom", "Top.Middle.Bottom"),
                    cached = bindingsResolver.cache["Top.Middle.Bottom"]["Top.*.Bottom"];
                it("Result should be true", function() {
                    assert(result).isTrue();
                });
                it("Should create a resolver cache entry", function(){
                    assert(cached).isTrue();
                });
            });
            describe("With topic Top.Middle.Bottom and binding #.*.Bottom", function(){
                var result = bindingsResolver.compare("#.*.Bottom", "Top.Middle.Bottom"),
                    cached = bindingsResolver.cache["Top.Middle.Bottom"]["#.*.Bottom"];
                it("Result should be true", function() {
                    assert(result).isTrue();
                });
                it("Should create a resolver cache entry", function(){
                    assert(cached).isTrue();
                });
            });
        });
    });
});