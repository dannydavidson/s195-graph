var Profiles = require( '../models/profiles' );

/**
 * GET /profiles
 */
module.exports.getLikes = function ( req, res, next ) {
	res.json( {
		status: 'OK'
	} )
};

module.exports.addLike = function ( req, res, next ) {
	res.json( {
		status: 'OK'
	} )
}
