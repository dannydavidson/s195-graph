#!/usr/bin/env node

/* global console: true */

var _ = require( 'underscore' ),
	async = require( 'async' ),
	request = require( 'request' ),

	// Model
	Profiles = require( './models/profiles' ),

	// profile urls
	listUrl = _.template( 'http://www.sport195.com/api/service/-/profiles/<%= context %>?page=<%= page %>&per_page=<%= per_page %>&mode=<%= mode %>' ),

	// params
	context = 'athletes',
	start = 1,
	end = 10,
	per_page = 10,
	mode = 'full';

( function () {

	_( _.range( start, end ) ).each( function ( i ) {

		var url = listUrl( {
			context: context,
			page: i,
			per_page: per_page,
			mode: mode
		} );

		request( url, function ( err, response, body ) {

			// parse data
			var data = JSON.parse( body ).data;

			// iterate through profiles
			async.each( data, function ( record ) {

				async.waterfall( _.values( {

						// query for profile by id
						getProfile: function ( callback ) {
							Profiles.get( record.id, record.context, function ( err, profile ) {
								callback( null, profile );
							} );
						},

						// break sequence if profile found, otherwise create node
						checkProfile: function ( profile, callback ) {
							if ( profile ) {
								callback( true, profile );
							} else {
								callback( null );
							}
						},

						// create node
						createNode: function ( callback ) {
							Profiles.create( _( record ).pick( 'display_name', 'context' ), record.context, function ( err, profile ) {
								callback( true, profile );
							} );
						}
					} ),

					function ( err, profile ) {
						if ( err === true ) {
							console.log( profile );
						} else {
							console.log( err );
						}
					} );


			} );

		} );

	} );

} )();
