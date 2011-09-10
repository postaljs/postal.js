var bindingsResolver = {
    cache: { },
    
    compare: function(binding, topic) {
        var rgx = new RegExp("^" + this.regexify(binding) + "$"); // match from start to end of string
        return rgx.test(topic);
    },
    
    regexify: function(binding) {
        return binding.replace(/\./g,"\\.") // escape actual periods
                      .replace(/\*/g, ".*") // asterisks match any value
                      .replace(/#/g, "[A-Z,a-z,0-9]*"); // hash matches any alpha-numeric 'word'
    }
};
