module.exports = function ( target, searchChannel, statChannel ) {
	target.bus = {
		subscriptions : [
			searchChannel.subscribe( "search.init", target.init ).withContext( target ),
			searchChannel.subscribe( "newTweets", target.processNewTweets ).withContext( target ),
			statChannel.subscribe( target.namespace + ".getLatest",
				function ( data, env ) {
					console.log( "GET LATEST FOR: " + target.namespace );
					statChannel.publish( {
						topic : target.namespace,
						data : target.lastStats,
						correlationId : env.correlationId
					} )
				} ).withContext( target )
		],
		publishers : [
			target.on( target.namespace, function ( data ) {
				statChannel.publish( { topic : target.namespace, data : data } );
			} )
		]
	};
	return target;
};