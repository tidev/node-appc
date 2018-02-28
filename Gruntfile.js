'use strict';

module.exports = function (grunt) {

	// Project configuration.
	grunt.initConfig({
		appcJs: {
			src: [
				'index.js',
				'Gruntfile.js',
				'lib/**/*.js',
				'test/**/*.js'
			]
		},
		mocha_istanbul: {
			options: {
				timeout: 30000,
				reporter: 'mocha-jenkins-reporter',
				ignoreLeaks: false,
				reportFormats: [ 'cobertura' ],
				check: {
					statements: 59,
					branches: 50,
					functions: 62,
					lines: 59
				}
			},
			src: [ 'test/test-*.js' ]
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-mocha-istanbul');
	grunt.loadNpmTasks('grunt-appc-js');

	// register tasks
	grunt.registerTask('lint', [ 'appcJs' ]);
	grunt.registerTask('test', [ 'mocha_istanbul' ]);
	grunt.registerTask('default', [ 'lint', 'test' ]);
};
