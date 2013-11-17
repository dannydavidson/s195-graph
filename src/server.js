/* global setInterval: true */

var restify = require( 'restify' ),
	swagger = require( 'swagger-node-restify' ),
	routes = require( './routes' ),
	debug = require( 'debug' )( 'firebase' ),
	env = module.exports.env = 'prod',

	Firebase = require( 'firebase' ),
	FirebaseTokenGenerator = require( 'firebase-token-generator' ),
	FIREBASE = 'https://s195.firebaseio.com',
	FIREBASE_SECRET = 'G3Fb6el1IciyKqowfx1rAGktzIZ6BMVDJdYmZBKj',

	authFirebase = module.exports.authFirebase = function ( callback ) {

		var tokenGenerator = new FirebaseTokenGenerator( FIREBASE_SECRET ),
			token = tokenGenerator.createToken( {
				user: 'server'
			} ),
			ref = new Firebase( FIREBASE );

		ref.auth( token, callback );
	};

// create the server instance for our service
module.exports.createServer = function createServer( port, environment, callback ) {

	// set environment
	env = environment;

	// initalize http server
	var server = restify.createServer( {
		name: 's195-graph',
		version: '0.0.1'
	} );

	server.use( restify.acceptParser( server.acceptable ) );
	server.use( restify.queryParser() );
	server.use( restify.bodyParser() );
	server.use( restify.gzipResponse() );

	// open up cross-domain access
	restify.defaultResponseHeaders = function () {
		this.header( 'Access-Control-Allow-Origin', '*' );
	};

	// auth with firebase before starting server
	authFirebase( function ( err ) {
		if ( !err ) {

			// pass server to swagger
			swagger.setAppHandler( server );

			// attach router handlers
			routes.attachHandlers( swagger );

			// configure swagger
			swagger.configureSwaggerPaths( '', '/docs', '' );
			swagger.configure( 'http://dannydavidson.com:3000', '0.1' );

			// pass back server
			callback( server );

		} else {
			throw new Error( 'Could not authenticate with firebase.' );
		}
	} );

	// set up refresh interval
	setInterval( authFirebase, 1000 * 60, function ( err ) {
		if ( !err ) {
			debug( 'refreshed' );
		} else {
			debug( err );
		}
	} );

};
