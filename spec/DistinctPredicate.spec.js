QUnit.specify('postal.js', function () {
  describe('DistinctPredicate', function () {

    describe('When calling the function with the same data object multiple times', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred({career: 'ninja'}));
      results.push(pred({career: 'ninja'}));
      results.push(pred({career: 'ninja'}));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be false', function () {
        assert(results[1]).isFalse();
      });
      it('the third result should be false', function () {
        assert(results[2]).isFalse();
      });
    });

    describe('When calling the function with the same primitive multiple times', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred('ninja'));
      results.push(pred('ninja'));
      results.push(pred('ninja'));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be false', function () {
        assert(results[1]).isFalse();
      });
      it('the third result should be false', function () {
        assert(results[2]).isFalse();
      });
    });

    describe('When calling the function with the same array multiple times', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred(['Jack Black', 'Kyle Gass']));
      results.push(pred(['Jack Black', 'Kyle Gass']));
      results.push(pred(['Jack Black', 'Kyle Gass']));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be false', function () {
        assert(results[1]).isFalse();
      });
      it('the third result should be false', function () {
        assert(results[2]).isFalse();
      });
    });

    // ------------------------------------------

    describe('When calling the function with different data object every time', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred({codename: 'tinker'}));
      results.push(pred({codename: 'tailor'}));
      results.push(pred({codename: 'soldier'}));
      results.push(pred({codename: 'spy'}));

      it('all results should be true', function () {
        var i = 0, length = results.length;
        for (i; i < length; i += 1) {
          assert(results[i]).isTrue();
        }
      });
    });

    describe('When calling the function with different primitive every time', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred(100.5));
      results.push(pred(12));
      results.push(pred(40.32));
      results.push(pred(0));

      it('all results should be true', function () {
        var i = 0, length = results.length;
        for (i; i < length; i += 1) {
          assert(results[i]).isTrue();
        }
      });
    });

    describe('When calling the function with different array every time', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred([]));
      results.push(pred(['chrome', 'firefox', 'ie', 'opera']));
      results.push(pred(['windows', 'linux', 'osx']));
      results.push(pred(['Leonardo', 'Raphael', 'Donatello', 'Michelangelo']));

      it('all results should be true', function () {
        var i = 0, length = results.length;
        for (i; i < length; i += 1) {
          assert(results[i]).isTrue();
        }
      });
    });

    // ------------------------------------------

    describe('When calling the function with different data object between duplicates', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred({game: 'Diablo 3'}));
      results.push(pred({game: 'Bioshock'}));
      results.push(pred({game: 'Batman: Arkham City'}));
      results.push(pred({game: 'Diablo 3'}));
      results.push(pred({game: 'Team Fortress 2'}));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be true', function () {
        assert(results[1]).isTrue();
      });
      it('the third result should be true', function () {
        assert(results[2]).isTrue();
      });
      it('the fourth result should be false', function () {
        assert(results[3]).isFalse();
      });
      it('the fifth result should be true', function () {
        assert(results[4]).isTrue();
      });
    });

    describe('When calling the function with different primitive between duplicates', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred('Stan Marsh'));
      results.push(pred('Kyle Broflovski'));
      results.push(pred('Eric Cartman'));
      results.push(pred('Stan Marsh'));
      results.push(pred('Kenny McCormick'));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be true', function () {
        assert(results[1]).isTrue();
      });
      it('the third result should be true', function () {
        assert(results[2]).isTrue();
      });
      it('the fourth result should be false', function () {
        assert(results[3]).isFalse();
      });
      it('the fifth result should be true', function () {
        assert(results[4]).isTrue();
      });
    });

    describe('When calling the function with different array between duplicates', function () {
      var pred = new DistinctPredicate(),
        results = [];

      results.push(pred([]));
      results.push(pred(['Hannibal', 'Face', 'Murdock', 'Mr. T']));
      results.push(pred([4, 8, 15, 16, 23, 42]));
      results.push(pred([]));
      results.push(pred([{x: 10, y: 20}, {x: 50, y: 100}]));

      it('the first result should be true', function () {
        assert(results[0]).isTrue();
      });
      it('the second result should be true', function () {
        assert(results[1]).isTrue();
      });
      it('the third result should be true', function () {
        assert(results[2]).isTrue();
      });
      it('the fourth result should be false', function () {
        assert(results[3]).isFalse();
      });
      it('the fifth result should be true', function () {
        assert(results[4]).isTrue();
      });
    });

  });
});