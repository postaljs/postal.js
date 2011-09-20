var bindingsResolver = {
    cache: { },

    compare: function(binding, topic) {
        if(this.cache[topic] && this.cache[topic][binding]) {
            return true;
        }
        var rgx = new RegExp("^" + this.regexify(binding) + "$"), // match from start to end of string
            result = rgx.test(topic);
        if(result) {
            if(!this.cache[topic]) {
                this.cache[topic] = {};
            }
            this.cache[topic][binding] = true;
        }
        return result;
    },

    regexify: function(binding) {
        return binding.replace(/\./g,"\\.") // escape actual periods
                      .replace(/\*/g, ".*") // asterisks match any value
                      .replace(/#/g, "[A-Z,a-z,0-9]*"); // hash matches any alpha-numeric 'word'
    }
};
