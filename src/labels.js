var _ = require( 'underscore' ),
	flat = require( 'flat' ),
	LABEL_DELIMITER = ':',

	// define label hierarchy
	config = {

		'profiles': {
			'users': true,
			'participants': {
				'athletes': true,
				'teams': true
			},
			'orgs': {
				'clubs': true,
				'leagues': true,
				'media_partners': true,
				'brands': true,
				'schools': {
					'highschool': true,
					'university': true
				}
			},
			'sports': true,
			'venues': true,
			'events': true,
			'geographies': {
				'cities': true,
				'regions': true,
				'countries': true
			}
		},

		'boards': true,
		'events': true,

		'content': {
			'messages': {
				'news_stories': true,
				'images': true,
				'videos': true,
				'posts': true
			}
		}
	},

	// create lookup table
	index = ( function ( config ) {
		var index,
			flattened = flat.flatten( config, {
				delimiter: LABEL_DELIMITER
			} );

		index = _( flattened ).chain().map( function ( val, key ) {
			return [ _.last( key.split( LABEL_DELIMITER ) ), LABEL_DELIMITER + key ];
		} ).object().value();


		index.schools = ':schools';
		index.geographies = ':geographies';

		return index;

	} )( config );

/**
	Get the labels for a context
	@param  {String} context context of item
	@return {String} the labels to pass into a CYPHER query, prepended with a :
 */
module.exports.labels = function ( context ) {
	var labels = index[ context ];
	return !_( labels ).isUndefined() ? labels : '';
};

/**
	Get the label for a context
	@param  {String} context context of item
	@return {String} the label to pass into a CYPHER query, prepended with a `:`. If not valid, returns `''`.
 */
module.exports.label = function ( context ) {
	return _( index ).has( context ) ? LABEL_DELIMITER + context : '';
};

/**
 * Safely check a context, returns context if valid, null if not
 */
module.exports.context = function ( context ) {
	return _( index ).has( context ) ? context : null;
};
