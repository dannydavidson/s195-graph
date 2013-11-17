#!/usr/bin/env node

var _ = require( 'underscore' ),
	request = require( 'request' ),
	neo = require( '../src/models/neo' ),
	labels = require( '../src/labels' ),

	// profile urls
	listUrl = _.template( 'http://www.sport195.com/api/service/-/profiles/<%= context %>?page=<%= page %>&per_page=<%= per_page %>' ),
	detailUrl = _.template( 'http://www.sport195.com/api/service/-/profiles/<%= context %>/<%= id %>?mode=<%= mode %>' ),

	// params
	contexts = [ 'teams', 'athletes' ],
	start = 0,
	end = 100,
	per_page = 100,

	associations = {
		'athletes': [
			[ 'teams', 'MEMBER_OF' ],
			[ 'sports', 'PLAYS' ]
		],
		'teams': [
			[ 'schools', 'PLAYS_FOR' ],
			[ 'clubs', 'PLAYS_FOR' ],
			[ 'leagues', 'PLAYS_FOR' ],
			[ 'sports', 'PLAYS' ]
		]
	},

	addProfile = function ( profile ) {
		var url = detailUrl( {
			context: profile.context,
			id: profile.id,
			mode: 'full'
		} );

		request( url, function ( err, response, body ) {

			var q,
				data = JSON.parse( body ).data;

			// add associations
			_( associations[ data.context ] ).each( function ( settings ) {
				_( data.associations[ settings[ 0 ] ] ).each( function ( association ) {

					var q = [

					'MERGE (left{LABELS} {id: "{id}" })'.replace( '{LABELS}', labels.labels( data.context ) ).replace( '{id}', data.id.toString() ),
					'MERGE (right{LABELS} {id: "{id}" })'.replace( '{LABELS}', labels.labels( association.context ) ).replace( '{id}', association.id.toString() ),

					'ON CREATE SET left.created = timestamp()',
					'ON CREATE SET left.display_name = "{display_name}"'.replace( '{display_name}', data.display_name ),
					'ON CREATE SET left.context = "{context}"'.replace( '{context}', data.context ),

					'ON MATCH SET left.updated = timestamp()',
					'ON MATCH SET left.display_name = "{display_name}"'.replace( '{display_name}', data.display_name ),
					'ON MATCH SET left.context = "{context}"'.replace( '{context}', data.context ),

					'ON CREATE SET right.created = timestamp()',
					'ON CREATE SET right.display_name = "{display_name}"'.replace( '{display_name}', association.display_name ),
					'ON CREATE SET right.context = "{context}"'.replace( '{context}', association.context ),

					'ON MATCH SET right.updated = timestamp()',
					'ON MATCH SET right.display_name = "{display_name}"'.replace( '{display_name}', association.display_name ),
					'ON MATCH SET right.context = "{context}"'.replace( '{context}', association.context ),

					'WITH left, right',
					'MERGE (left)-[r:{RELATION}]->(right)'.replace( '{RELATION}', settings[ 1 ] ),
					'SET r.created = timestamp()'
					];

					neo.query( q );

				} );
			} );

			// add location
			if ( data.location ) {

				q = [

				'MERGE (left{LABELS} {id: "{id}" })'.replace( '{LABELS}', labels.labels( data.context ) ).replace( '{id}', data.id.toString() ),
				'MERGE (right{LABELS} {id: "{id}" })'.replace( '{LABELS}', labels.labels( data.location.context ) ).replace( '{id}', data.location.id.toString() ),

				'ON CREATE SET left.created = timestamp()',
				'ON CREATE SET left.display_name = "{display_name}"'.replace( '{display_name}', data.display_name ),
				'ON CREATE SET left.context = "{context}"'.replace( '{context}', data.context ),

				'ON MATCH SET left.updated = timestamp()',
				'ON MATCH SET left.display_name = "{display_name}"'.replace( '{display_name}', data.display_name ),
				'ON MATCH SET left.context = "{context}"'.replace( '{context}', data.context ),

				'ON CREATE SET right.created = timestamp()',
				'ON CREATE SET right.display_name = "{display_name}"'.replace( '{display_name}', data.location.display_name ),
				'ON CREATE SET right.context = "{context}"'.replace( '{context}', data.location.context ),

				'ON MATCH SET right.updated = timestamp()',
				'ON MATCH SET right.display_name = "{display_name}"'.replace( '{display_name}', data.location.display_name ),
				'ON MATCH SET right.context = "{context}"'.replace( '{context}', data.location.context ),

				'WITH left, right',
				'MERGE (left)-[r:{RELATION}]->(right)'.replace( '{RELATION}', 'IS_LOCATED' ),
				'SET r.created = timestamp()'
				];

				neo.query( q );

			}

		} );
	};

( function () {

	_( contexts ).each( function ( context ) {

		_( _.range( start, end ) ).each( function ( i ) {

			var url = listUrl( {
				context: context,
				page: i,
				per_page: per_page
			} );

			request( url, function ( err, response, body ) {

				// parse data
				var data = JSON.parse( body ).data;

				// iterate through profiles
				_.each( data, function ( record ) {
					addProfile( record );
				} );

			} );

		} );

	} );


} )();
