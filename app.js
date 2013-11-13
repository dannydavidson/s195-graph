/* global process: true, console: true */

var express = require( 'express' ),
	routes = require( './routes' ),
	http = require( 'http' ),

	app = express();

// all environments
app.set( 'port', process.env.PORT || 3000 );
app.use( express.logger( 'dev' ) );
app.use( express.bodyParser() );
app.use( express.methodOverride() );
app.use( app.router );

// development only
if ( 'development' === app.get( 'env' ) ) {
	app.use( express.errorHandler() );
}

app.locals( {
	title: 's195-graph'
} );

// Routes

app.get( '/profiles/:id/likes', routes.profiles.getLikes );
app.post( '/profiles/:id/likes/:other', routes.profiles.addLike );

http.createServer( app ).listen( app.get( 'port' ), function () {
	console.log( 'Express server listening on port ' + app.get( 'port' ) );
} );
