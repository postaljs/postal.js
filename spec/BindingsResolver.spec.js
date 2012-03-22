QUnit.specify("postal.js", function(){
	describe("bindingsResolver", function(){
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