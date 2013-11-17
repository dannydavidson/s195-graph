module.exports = function ( grunt ) {

	grunt.initConfig( {

		pkg: grunt.file.readJSON( 'package.json' ),

		nodemon: {
			dev: {
				options: {
					file: './bin/dev.js',
					nodeArgs: [ '--debug=3001' ],
					env: {
						DEBUG: '*'
					}
				}
			},
			debug: {
				options: {
					file: './bin/dev.js',
					nodeArgs: [ '--debug-brk=3001' ],
					env: {
						DEBUG: '*'
					}
				}
			},
			monitor: {
				options: {
					file: './bin/monitor.js',
					nodeArgs: [ '--debug=3002' ],
					env: {
						DEBUG: 'monitor'
					}
				}
			}
		},

		docco: {
			src: {
				src: [ 'src/**/*.js' ],
				options: {
					output: 'docs/src/'
				}
			},
			bin: {
				src: [ 'bin/**/*.js' ],
				options: {
					output: 'docs/bin/'
				}
			}
		}

	} );

	grunt.loadNpmTasks( 'grunt-docco' );
	grunt.loadNpmTasks( 'grunt-nodemon' );

	grunt.registerTask( 'docs', function () {
		grunt.task.run( 'docco:src' );
		grunt.task.run( 'docco:bin' );
	} );

	grunt.registerTask( 'dev', function () {
		grunt.task.run( 'nodemon:dev' );
	} );

	grunt.registerTask( 'debug', function () {
		grunt.task.run( 'nodemon:debug' );
	} );

	grunt.registerTask( 'monitor', function () {
		grunt.task.run( 'nodemon:monitor' );
	} );

};
