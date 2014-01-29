/*global _postal */
_postal.linkChannels = function ( sources, destinations ) {
    var result = [], self = this;
    sources = !_.isArray( sources ) ? [ sources ] : sources;
    destinations = !_.isArray( destinations ) ? [destinations] : destinations;
    _.each( sources, function ( source ) {
        var sourceTopic = source.topic || "#";
        _.each( destinations, function ( destination ) {
            var destChannel = destination.channel || self.configuration.DEFAULT_CHANNEL;
            result.push(
                self.subscribe( {
                    channel  : source.channel || self.configuration.DEFAULT_CHANNEL,
                    topic    : sourceTopic,
                    callback : function ( data, env ) {
                        var newEnv = _.clone( env );
                        newEnv.topic = _.isFunction( destination.topic ) ? destination.topic( env.topic ) : destination.topic || env.topic;
                        newEnv.channel = destChannel;
                        newEnv.data = data;
                        self.publish( newEnv );
                    }
                } )
            );
        });
    });
    return result;
};