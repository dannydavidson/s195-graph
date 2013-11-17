/* jshint node: true */

var Q = require( 'q' ),
	debug_query = require( 'debug' )( 'neo:query' ),
	debug_result = require( 'debug' )( 'neo:result' ),
	neo4j = require( 'neo4j' ),
	neo = new neo4j.GraphDatabase( process.env.NEO4J_URL || 'http://localhost:7474' );

module.exports.query = function ( q, params ) {

	var deferred = Q.defer(),
		start_time = Date.now();

	debug_query( '\n' + q.join( '\n' ) + '\n' + JSON.stringify( params, undefined, 2 ) + '\n' );

	neo.query( q.join( '\n' ), params || {}, function ( err, results ) {

		var now = Date.now();

		if ( !err ) {
			// add query time to stats
			results.stats.time = now - start_time;
			debug_result( '\n' + JSON.stringify( results, undefined, 2 ) + '\n' );
			deferred.resolve( results );
		} else {
			debug_result( '\n' + JSON.stringify( err, undefined, 2 ) + '\n' );
			deferred.reject( err );
		}

	} );

	return deferred.promise;

};

module.exports.db = neo;
