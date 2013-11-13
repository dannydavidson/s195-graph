/*global process: true */

var neo4j = require( 'neo4j' ),
	db = new neo4j.GraphDatabase( process.env.NEO4J_URL || 'http://localhost:7474' );

// constants:

var INDEX_NAME = 'profiles';
var INDEX_KEY = 'context';


// private constructor:

var Profiles = module.exports = function Profiles( _node ) {
	// all we'll really store is the node; the rest of our properties will be
	// derivable or just pass-through properties (see below).
	this._node = _node;
};

// public instance properties:

Object.defineProperty( Profiles.prototype, 'id', {
	get: function ( ) {
		return this._node.id;
	}
} );

Object.defineProperty( Profiles.prototype, 'exists', {
	get: function ( ) {
		return this._node.exists;
	}
} );

Object.defineProperty( Profiles.prototype, 'name', {
	get: function ( ) {
		return this._node.data.name;
	},
	set: function ( name ) {
		this._node.data.name = name;
	}
} );

Object.defineProperty( Profiles.prototype, 'context', {
	get: function ( ) {
		return this._node.data.context;
	},
	set: function ( context ) {
		this._node.data.context = context;
	}
} );

// public instance methods:

Profiles.prototype.save = function ( callback ) {
	this._node.save( function ( err ) {
		callback( err );
	} );
};

Profiles.prototype.del = function ( callback ) {
	this._node.del( function ( err ) {
		callback( err );
	}, true ); // true = yes, force it (delete all relationships)
};

Profiles.prototype.likes = function ( other, callback ) {
	var data = {
		timestamp: Date.now( )
	};
	this._node.createRelationshipTo( other._node, 'likes', data, function ( err, rel ) {
		callback( err, rel );
	} );
};


// static methods:

Profiles.get = function ( id, callback ) {
	db.getNodeById( id, function ( err, node ) {
		if ( err ) {
			return callback( err );
		}
		callback( null, new Profiles( node ) );
	} );
};

// creates the profile and persists (saves) it to the db, incl. indexing it:
Profiles.create = function ( data, callback ) {
	var node = db.createNode( data ),
		profile = new Profiles( node );

	node.save( function ( err ) {
		if ( err ) {
			return callback( err );
		}
		node.index( INDEX_NAME, INDEX_KEY, profile.context, function ( err ) {
			if ( err ) {
				return callback( err );
			}
			callback( null, profile );
		} );
	} );
};
