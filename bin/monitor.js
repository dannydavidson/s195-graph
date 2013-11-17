/* global setInterval */

var _ = require( 'underscore' ),
	zmq = require( 'zmq' ),
	neo = require( '../src/models/neo' ),
	db = neo.db,
	debug = require( 'debug' )( 'monitor' ),
	firedebug = require( 'debug' )( 'firebase' ),
	error = require( 'debug' )( 'error' ),
	redis = require( 'redis' ),
	Firebase = require( 'firebase' ),
	FIREBASE = 'https://s195.firebaseio.com/likes/',
	authFirebase = require( '../src/server' ).authFirebase,

	cache,
	monitor,

	currentNode = 0,
	query = 'MATCH (n:{context})<-[r:LIKES]-(m:users) WHERE n.id = {id} RETURN count(r) as count;';

cache = redis.createClient();
cache.on( 'error', function ( err ) {
	error( err );
} );

monitor = zmq.socket( 'sub' );
monitor.subscribe( '' );
monitor.on( 'message', function ( key ) {
	// TODO push keys into some kind of FIFO queue
	// to be prioritized in recount sweep
} );

authFirebase( function () {
	// a simplistic, unoptimized recount sweep
	setInterval( function () {
		db.getNodeById( currentNode, function ( err, node ) {
			if ( !err ) {
				node = node._data.data;
				currentNode += 1;

				neo.query( [ query.replace( '{context}', node.context ) ], _( node ).pick( 'id' ) )
					.then( function ( results ) {

						var key = 'LIKES:' + node.context + ':' + node.id,
							count = results.results[ 0 ].count;
						debug( key, count );
						cache.get( key, function ( err, cached ) {
							if ( count !== cached ) {
								cache.set( key, count, function ( err, result ) {
									if ( !err ) {
										var fire = new Firebase( FIREBASE + node.context + '/' + node.id );
										fire.set( count );
									} else {
										error( err );
									}
								} );
							}
						} );
					} )
					.fail( function ( err ) {
						error( err );
					} );
			} else {
				currentNode = 0;
			}
		} );
	}, 1000 );
} )

// set up refresh interval
setInterval( authFirebase, 1000 * 60, function ( err ) {
	if ( !err ) {
		firedebug( 'refreshed' );
	} else {
		firedebug( err );
	}
} );

monitor.connect( 'ipc://likes.ipc' );
