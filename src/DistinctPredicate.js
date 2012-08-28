var DistinctPredicate = function () {
  var previous = [];

  return function (data) {
    var isDistinct = !_.any(previous, function (p) {
      if (_.isObject(data) || _.isArray(data)) {
        return _.isEqual(data, p);
      }
      return data === p;
    });
    if (isDistinct) {
      previous.push(data);
    }
    return isDistinct;
  };
};