module.exports = function( target, searchChannel, statsChannel ) {
	target.bus = {
		subscriptions: [],
		publishers: [
			target.on( "newTweets", function( data ) {
				statsChannel.publish( { topic: "newTweets", data: data } );
			} ),
			target.on( "search.current", function( data ) {
				searchChannel.publish( { topic: "search.current", data: data } );
			} ),
			target.on( "search.nodata", function( data ) {
				searchChannel.publish( { topic: "search.nodata", data: data } );
			} )
		]
	};
	return target;
};