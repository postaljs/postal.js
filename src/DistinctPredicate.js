var DistinctPredicate = function() {
    var previous;
    return function(data) {
        var result = _.isEqual(data, previous);
        previous = _.clone(data);
        return result;
    };
};