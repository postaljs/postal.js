var socket, port;

$(function() {
	port = window.location.port
	socket = io.connect( "http://" + document.domain + ':' + port + '/' );
	socket.on('connect', function () {
		socket.on( 'refresh', function () {
			window.location.reload();
		} );
		socket.on( 'reconnecting', function() {
			console.log( 'Lost connection to anvil, attempting to reconnect', 'warning' );
		} );
		socket.on( 'reconnect', function() {
			alert( 'Reconnection to anvil succeeded' );
		} );
		socket.on( 'reconnect_failed', function() {
			console.log( 'Reconnected to anvil failed', 'error' );
		} );
		socket.on( 'connect_failed', function() {
			console.log( 'Could not connect to anvil', 'error' );
		} );
		socket.on( 'disconnect', function() {
			alert( 'Anvil server has disconnected', 'error' );
		} );
	} );
} );