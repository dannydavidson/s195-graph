#!/usr/bin/env node

var _ = require( 'underscore' ),
	stream = require( 'stream' ),
	async = require( 'async' ),
	debugMySql = require( 'debug' )( 'mysql' ),
	neo = require( '../src/models/neo' ),
	labels = require( '../src/labels' ),
	sql = require( 'mysql' ),

	NUM_PARALLEL = 10,
	READ_THROTTLE = 100,

	queryFormat = function ( query, values ) {
		if ( !values ) {
			return query;
		}

		query = query.replace( /\:(\w+)/g, function ( txt, key ) {
			if ( values.hasOwnProperty( key ) ) {
				return this.escape( values[ key ] );
			}
			return txt;
		}.bind( this ) );

		return query.replace( /\:\*(\w+)/g, function ( txt, key ) {
			if ( values.hasOwnProperty( key ) ) {
				return sql.escapeId( values[ key ] );
			}
			return txt;
		} )
	},

	pool = sql.createPool( {
		host: '10.9.0.1',
		user: 'sport195',
		password: 'sidusa123',
		database: 'sport195',
		connectionLimit: NUM_PARALLEL
	} ),

	nodeInsertQuery = [],
	nodes,
	rels;

function RowHandler( options, func ) {
	this.options = options;
	this.handleRow = func;
	stream.Writable.call( this, {
		objectMode: true
	} );
}

RowHandler.prototype = Object.create( stream.Writable.prototype, {
	constructor: {
		value: RowHandler
	}
} );

RowHandler.prototype._write = function ( row, encoding, callback ) {
	this.handleRow( row, callback );
};

nodes = [
	new RowHandler( {
		table: 'athletes',
		node: 'athletes'
	}, function ( row, callback ) {
		console.log( row );
		callback();
	} ),
	new RowHandler( {
		table: 'athletes',
		node: 'athletes'
	}, function ( row, callback ) {
		console.log( row );
		callback();
	} )
 ];

nodes = _( nodes ).map( function ( node ) {
	return function ( callback ) {
		pool.getConnection( function ( err, connection ) {
			connection.config.queryFormat = queryFormat;
			var q = connection.query( 'SELECT * FROM :*table LIMIT 100', {
				table: node.options.table
			} )
				.on( 'error', function ( err ) {
					console.log( err );
				} )
				.on( 'end', function () {
					console.log( 'end' );
					connection.release();
					callback();
				} )
				.stream( {
					highWaterMark: READ_THROTTLE
				} )
				.pipe( node );
		} );
	}
} );

async.parallelLimit( nodes, NUM_PARALLEL, function () {
	console.log( 'done' );
} );
