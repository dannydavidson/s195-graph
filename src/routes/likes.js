/* jshint multistr: true, node: true, -W015 */

// Helper libraries
var _ = require( 'underscore' ),
	error = require( 'debug' )( 'error' ),
	swagger = require( 'swagger-node-restify' ),
	valid = require( 'validator' ),
	restify = require( 'restify' ),
	async = require( 'async' ),

	// Set up a labels abstraction so we can
	// validate and properly add the right label hierarchy
	// to nodes when they are created.
	labels = require( '../labels' ),

	// A little wrapper around node-neo4j
	// so we can use a defer.
	neo = require( '../models/neo' ),

	// If we want to implement realtime features soonest,
	// this SaaS option looks to be solid and scalable.
	// https://www.firebase.com/docs/
	Firebase = require( 'firebase' ),
	FIREBASE = 'https://s195.firebaseio.com/likes/',

	// Even if Firebase is out of reach we should use a
	// persistent memory store for counts, etc.
	redis = require( 'redis' ),
	cache = redis.createClient(),

	// If redis or firebase fails to write, the counts will
	// get out of sync. On error we use zmq to PUB to a monitor
	// process that can sync things back up
	zmq = require( 'zmq' ),
	monitor = zmq.socket( 'pub' ),

	// Constant for relationship type.  Used as relationship
	// type in neo and top-level namespace for redis and firebase.
	RELATION = 'LIKES',

	getLikesKey = function ( context, id ) {
		return RELATION + ':' + context + ':' + id;
	},

	addLike = {
		'spec': {
			'description': 'This `POST` expects the `context` and `id` of the `user` and `subject` being \
							liked.  It `MERGE`s both nodes, adding a `created` timestamp `ON CREATE` and updating \
							an `updated` timestamp `ON MATCH`. It then adds a `:LIKES` relationship between the \
							two nodes, setting a `created` timestamp on it. \
							Count is incremented for its `RELATION:context:id` key \
							in the redis cache and updated in Firebase.',
			'path': '/likes/{context}/{subject_id}/like',
			'summary': 'Add a like',
			'method': 'POST',
			'params': [
				swagger.pathParam( 'context', 'Context of subject', 'string' ),
				swagger.pathParam( 'subject_id', 'ID of subject', 'string' )
			],
			'errorResponses': [],
			'nickname': 'addLike'
		},
		'action': function ( req, res, next ) {

			var q,
				params = _( req.params ).pick( 'context', 'subject_id' ),
				payload = _( req.body ).pick( 'display_name', 'thumbnail', 'context', 'id' ),
				subjectLabel = labels.labels( params.context ),
				userLabel = labels.labels( 'users' ),
				subjectContext = labels.context( params.context ),
				userContext = labels.context( payload.context );

			if ( !subjectLabel || !subjectContext || !userContext ) {
				return next( new restify.InvalidArgumentError( 'Invalid context.' ) );
			}

			try {
				valid.check( payload.display_name ).notEmpty();
			} catch ( e ) {
				return next( new restify.InvalidArgumentError( 'Invalid display_name.' ) );
			}

			if ( payload.thumbnail ) {
				try {
					valid.check( payload.thumbnail ).isUrl();
				} catch ( e ) {
					return next( new restify.InvalidArgumentError( 'Invalid thumbnail.' ) );
				}
			}

			params = _.extend( params, payload );
			params.id = valid.sanitize( params.id ).trim();
			params.subject_id = valid.sanitize( params.subject_id ).trim();

			q = [

			'MERGE (subject{LABELS} {id: {subject_id} })'.replace( '{LABELS}', subjectLabel ),
			'MERGE (user{LABELS} {id:{id} })'.replace( '{LABELS}', userLabel ),

			'ON CREATE SET subject.created = timestamp()',
			'ON CREATE SET subject.context = "{context}"'.replace( '{context}', subjectContext ),
			'ON MATCH SET subject.updated = timestamp()',
			'ON MATCH SET subject.context = "{context}"'.replace( '{context}', subjectContext ),

			'ON CREATE SET user.created = timestamp()',
			'ON CREATE SET user.display_name = {display_name}',
			'ON CREATE SET user.context = "{context}"'.replace( '{context}', userContext ),

			'ON MATCH SET user.updated = timestamp()',
			'ON MATCH SET user.display_name = {display_name}',
			'ON MATCH SET user.context = "{context}"'.replace( '{context}', userContext ),

			'WITH subject, user',
			'MERGE (subject)<-[r:{RELATION}]-(user)'.replace( '{RELATION}', RELATION ),
			'SET r.created = timestamp()'

			];

			neo.query( q, params )
				.then( function ( results ) {
					var key;

					if ( results.stats.relationships_created === 1 ) {
						key = getLikesKey( subjectContext, params.subject_id );

						// If the relationship is created, increment count in redis and
						// set the new value as the count value in firebase.
						cache.incr( key, function ( err, result ) {
							if ( !err ) {
								var fire = new Firebase( FIREBASE + '{SUBJECT}/{ID}'.replace( '{SUBJECT}', subjectContext ).replace( '{ID}', params.subject_id ) );
								fire.set( result );
								return res.json( {
									count: result
								} );
							} else {
								monitor.send( key );

								// if redis fails return -1 for count to signal that count
								// was unfetchable
								return res.json( {
									count: -1
								} );
							}

						} );

					} else {
						return next( new restify.InvalidArgumentError( 'Subject has already been liked by user.' ) );
					}

				} )
				.fail( function ( err ) {
					return next( new restify.InternalError( err ) );
				} );
		}
	},

	removeLike = {
		'spec': {
			'description': 'This `POST` expects the `context` and `id` of the `user` and `subject` being \
							unliked. It first queries for a like between `id` and `subject`, if one exists \
							it removes it. \
							Count is decremented for its `RELATION:context:id` key \
							in the redis cache and updated in Firebase.',
			'path': '/likes/{context}/{subject_id}/unlike',
			'summary': 'Remove a like',
			'method': 'POST',
			'params': [
				swagger.pathParam( 'context', 'Context of subject', 'string' ),
				swagger.pathParam( 'subject_id', 'ID of subject', 'string' )
			],
			'errorResponses': [],
			'nickname': 'removeLike'
		},
		'action': function ( req, res, next ) {

			var q,
				params = _( req.params ).pick( 'context', 'subject_id' ),
				payload = _( req.body ).pick( 'context', 'id' ),
				subjectLabel = labels.label( params.context ),
				userLabel = labels.label( 'users' ),
				subjectContext = labels.context( params.context );

			if ( !subjectLabel ) {
				return next( new restify.InvalidArgumentError( 'Invalid context.' ) );
			}

			params = _.extend( params, payload );
			params.id = valid.sanitize( params.id ).trim();
			params.subject_id = valid.sanitize( params.subject_id ).trim();

			q = [

			'MATCH (subject{SUBJECT_LABEL})<-[r:{RELATION}]-(user{USER_LABEL})'.replace( '{SUBJECT_LABEL}', subjectLabel ).replace( '{RELATION}', RELATION ).replace( '{USER_LABEL}', userLabel ),
			'WHERE subject.id = {subject_id} AND user.id = {id}',
			'DELETE r;'

			];

			neo.query( q, params )
				.then( function ( results ) {
					var key;

					// if the relationship was deleted, decrement count in redis
					// and update count in firebase
					if ( results.stats.relationship_deleted > 0 ) {
						key = getLikesKey( subjectContext, params.subject_id );
						cache.decr( key, function ( err, count ) {
							var fire = new Firebase( FIREBASE + subjectContext + '/' + params.subject_id );
							fire.set( count );
							if ( !err ) {
								return res.json( {
									count: count
								} );
							} else {
								monitor.send( key );

								// if redis fails return -1 for count to signal that count
								// was unfetchable
								return res.json( {
									count: -1
								} );
							}
						} );
					} else {
						return next( new restify.InvalidArgumentError( 'Relationship cannot be deleted because it does not exist.' ) );
					}

				} )
				.fail( function ( err ) {
					return next( new restify.InternalError( err ) );
				} );
		}
	},


	// Get likes
	// ---------
	getLikes = {
		'spec': {
			'description': 'Get a list of likes for the `context`, `subject_id` pair.',
			'path': '/likes/{context}/{subject_id}',
			'summary': 'Get likes for subject',
			'method': 'GET',
			'params': [
				swagger.pathParam( 'context', 'Context of subject', 'string' ),
				swagger.pathParam( 'subject_id', 'ID of subject', 'string' )
			],
			'errorResponses': [],
			'nickname': 'getLikes'
		},
		'action': function ( req, res, next ) {

			var q,
				params = _( req.params ).pick( 'context', 'subject_id', 'per_page', 'page' ),
				subjectLabel = labels.label( params.context ),
				userLabel = labels.label( 'users' ),
				subjectId = params.subject_id.toString(),
				page = Number( params.page ) || 0,
				per_page = Number( params.per_page ) || 20;

			if ( !subjectLabel ) {
				return next( new restify.InvalidArgumentError( 'Invalid context.' ) );
			}

			q = [

			'MATCH (n{SUBJECT_LABEL})<-[r:{RELATION}]-(m{USER_LABEL})'.replace( '{SUBJECT_LABEL}', subjectLabel ).replace( '{RELATION}', RELATION ).replace( '{USER_LABEL}', userLabel ),
			'WHERE n.id="{id}"'.replace( '{id}', subjectId ),
			'RETURN m.display_name AS display_name, m.context as context, m.id as id, r.created as created',
			'ORDER BY r.created DESC',
			'SKIP {OFFSET}'.replace( '{OFFSET}', page * per_page ),
			'LIMIT {PER_PAGE}'.replace( '{PER_PAGE}', per_page )

			];

			neo.query( q, params )
				.then( function ( results ) {
					var key = getLikesKey( subjectLabel, subjectId ),
						payload = {
							page: page,
							per_page: per_page,
							data: results.results
						};

					// get the count from cache
					cache.get( key, function ( err, count ) {
						count = Number( count );
						if ( !err && count >= 0 ) {
							payload.count = count;
							payload.next_page = ( page * per_page < count );
						} else {
							monitor.send( key );
							// if cache fails, make a guess
							payload.next_page = results.results.length === per_page;
						}
						return res.json( payload );
					} );

				} )
				.fail( function ( err ) {
					return next( new restify.InternalError( err ) );
				} );

		}
	},

	getLikeStatus = {
		'spec': {
			'description': 'Provide an intersection service that returns \
							a boolean representing `user`\'s like status for every \
							`context:id` pair passed. \
							Neo4j 2.x adds support for transactions, \
							but the node binding doesn\'t yet support it.  The REST API looks \
							to be pretty straightforward, so it shouldn\'t be difficult to add it in. \
							http://docs.neo4j.org/chunked/preview/rest-api-transactional.html',
			'path': '/likes',
			'summary': 'Get likes intersections for user',
			'method': 'GET',
			'params': [],
			'errorResponses': [],
			'nickname': 'likeIntersect'
		},
		'action': function ( req, res, next ) {

			var queries,
				userLabel = labels.label( 'users' ),
				userId = req.params.user,
				ids = req.params.ids && _( req.params.ids.split( ',' ) ).chain().map( function ( key ) {
					var tuple = key.split( ':' ),
						id = tuple[ 1 ],
						label = tuple[ 0 ];

					try {
						valid.check( valid.sanitize( id ).toInt() ).isInt();
						valid.check( labels.label( label ) ).notEmpty();
						return [ id, label ];
					} catch ( e ) { /*silence*/ }
				} )
					.compact()
					.value();


			try {
				valid.check( userId ).notEmpty();
			} catch ( e ) {
				return next( new restify.InvalidArgumentError( 'Invalid user.' ) );
			}

			// build up object of id:function pairs to execute in parallel
			queries = _( ids ).chain().map( function ( tuple ) {

				var id = tuple[ 0 ],
					label = tuple[ 1 ];

				function query( callback ) {

					var q = [

					'MATCH (n{SUBJECT_LABEL})<-[:{RELATION}]-(m{USER_LABEL})'.replace( '{SUBJECT_LABEL}', labels.label( label ) ).replace( '{RELATION}', RELATION ).replace( '{USER_LABEL}', userLabel ),
					'WHERE n.id="{id}" AND m.id="{user_id}"'.replace( '{id}', id ).replace( '{user_id}', userId ),
					'RETURN m.id'

					];

					neo.query( q, {} )
						.then( function ( results ) {
							callback( null, results.results );
						} )
						.fail( function () {
							callback( true );
						} );
				}

				return [ label + ':' + id, query ];

			} ).object().value();

			async.parallel( queries, function ( err, results ) {
				if ( !err ) {
					return res.json( {
						data: _( results ).chain().map( function ( val, key ) {
							return _( val ).isEmpty() ? [ key, false ] : [ key, true ];
						} ).object().value()
					} );
				} else {
					return next( new restify.InternalError( err ) );
				}

			} );

		}
	};

module.exports = function attachHandlers( swagger ) {

	monitor.bindSync( 'ipc://likes.ipc' );
	swagger.addGet( getLikes );
	swagger.addPost( addLike );
	swagger.addPost( removeLike );
	swagger.addGet( getLikeStatus );

	cache.on( 'error', function ( err ) {
		error( err );
	} );

};
