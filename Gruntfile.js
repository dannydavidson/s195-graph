module.exports = function ( grunt ) {

	grunt.initConfig( {

		pkg: grunt.file.readJSON( 'package.json' ),

		bgShell: {
			serve: {
				cmd: 'node ./node_modules/nodemon/nodemon.js --debug app.js'
			}
		}

	} );

	grunt.loadNpmTasks( 'grunt-bg-shell' );

	grunt.registerTask( 'serve', function () {
		grunt.task.run( 'bgShell:serve' );
	} );

};
