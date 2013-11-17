var port = 3000;

require( '../src/server' ).createServer( port, 'dev', function ( server ) {
	server.listen( port, function () {
		console.log( 'accepting requests on port ' + port + ' ...' );
	} );
} );
