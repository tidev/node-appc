/**
 * Detects if Java and the JDK are installed.
 *
 * @module jdk
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var __ = require('./i18n')(__dirname).__,
	mix = require('./util').mix,
	sp = require('./subprocess'),
	run = sp.run,
	findExecutable = sp.findExecutable,
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	cache;

/**
 * Detects if Java and the JDK are installed.
 * @param {Object} [config] - The CLI configuration
 * @param {Object} [opts] - Detection options; currently only 'bypassCache'
 * @param {Function} finished - A function to call with the result
 * @example
 * require('./lib/jdk').detect(function (r) { console.log(r); });
 */
exports.detect = function detect(config, opts, finished) {
	if (typeof config == 'function') {
		// 1 arg (function)
		finished = config;
		config = {};
		opts = {};
	} else if (typeof opts == 'function') {
		// 2 args (object, function)
		finished = opts;
		opts = {};
	} else {
		opts || (opts = {});
	}

	if (cache && !opts.bypassCache) return finished(cache);

	var exe = process.platform == 'win32' ? '.exe' : '',
		javaHome = process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME) ? process.env.JAVA_HOME : null,
		result = cache = {
			version: null,
			build: null,
			home: null,
			executables: {},
			issues: []
		};

	if (process.platform == 'darwin') {
		// since mac os x 10.7 (lion), java is not installed by default, so
		// we need to manually check
		run('/usr/libexec/java_home', function (err, stdout, stderr) {
			if (err) {
				result.issues.push({
					id: 'JDK_NOT_INSTALLED',
					type: 'error',
					message: __('Java Development Kit not installed.') + '\n'
						+ __('Mac OS X 10.7 (Lion) and newer do not include the JDK and must be manually downloaded and installed from %s.',
						'__http://www.oracle.com/technetwork/java/javase/downloads/index.html__')
				});
				finished(result);
			} else {
				checkCommands(stdout.trim());
			}
		});
	} else {
		checkCommands();
	}

	function checkCommands(additionalJavaHome) {
		var tasks = {};

		['java', 'javac', 'keytool', 'jarsigner'].forEach(function (cmd) {
			tasks[cmd] = function (next) {
				var paths = [];
				config && config.get && paths.push(config.get('java.executables.' + cmd));
				javaHome && paths.push(path.join(javaHome, 'bin', cmd + exe));
				additionalJavaHome && paths.push(path.join(additionalJavaHome, 'bin', cmd + exe));
				paths.push(cmd + exe);
				findExecutable(paths, function (err, r) {
					next(null, r || null);
				});
			};
		});

		async.parallel(tasks, function (err, executables) {
			result.executables = executables;

			if (Object.keys(tasks).every(function (cmd) { return !executables[cmd]; })) {
				// all commands are null, so no jdk found, check if we already discovered this
				if (!result.issues.some(function (i) { return i.id == 'JDK_NOT_INSTALLED'; })) {
					result.issues.push({
						id: 'JDK_NOT_INSTALLED',
						type: 'error',
						message: __('Java Development Kit not installed.') + '\n'
							+ __('The JDK is required for must be manually downloaded and installed from %s.',
								'__http://www.oracle.com/technetwork/java/javase/downloads/index.html__')
					});
				}
			} else {
				// check if any command was missing
				var missing = Object.keys(tasks).filter(function (cmd) { return !executables[cmd]; });
				if (missing.length) {
					result.issues.push({
						id: 'JDK_MISSING_PROGRAMS',
						type: 'error',
						message: __("Unable to find Java Development Kit programs: %s.", '__' + missing.join(', ') + '__') + '\n'
							+ __('Please verify your system path or that the JAVA_HOME environment variable is correctly defined.') + '\n'
							+ __('You may want to reinstall the JDK by downloading it from %s.',
								'__http://www.oracle.com/technetwork/java/javase/downloads/index.html__')
					});
				}
			}

			// if we have javac, then at least we can get the version and guess the java home path
			if (executables.javac) {
				result.home = path.dirname(path.dirname(executables.javac));

				run(executables.javac, '-version', function (err, stdout, stderr) {
					// we don't care if this success since the regex would fail
					var m = stderr.match(/javac (.+)_(.+)/);
					if (m) {
						result.version = m[1];
						result.build = m[2];
					}
					finished(result);
				});
			} else {
				finished(result);
			}
		});
	}
};
