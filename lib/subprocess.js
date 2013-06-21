/**
 * @overview
 * Spawns a subprocess using exec()-like syntax, but using spawn().
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

/**
 * Spawns a subprocess using exec()-like syntax, but using spawn().
 * @module lib/subprocess
 */

var spawn = require('child_process').spawn,
	async = require('async'),
	afs = require('./fs');

/**
 * Spawns a subprocess using exec()-like syntax, but using spawn().
 * @param {String} cmd - The command to run
 * @param {Array} args - An array of arguments
 * @param {Object} [opts] - Options to pass to spawn()
 * @param {Function} callback - Function to call when the process finishes
 */
exports.subprocess = function subprocess(cmd, args, opts, callback) {
	if (!callback && typeof opts == 'function') {
		callback = opts;
		opts = {};
	}

	var child = spawn(cmd, args ? (Array.isArray(args) ? args : [args]) : null, opts),
		out = '',
		err = '';

	child.stdout.on('data', function (data) {
		out += data.toString();
	});

	child.stderr.on('data', function (data) {
		err += data.toString();
	});

	child.on('close', function (code) {
		callback(code, out, err);
	});
};

/**
 * Tries to locate the specified executable.
 * @param {Array} paths - An array of paths to check
 * @param {Function} callback - A function to call when done searching
 */
exports.findExecutable = function findExecutable(paths, finished) {
	var queue = async.queue(function (path, callback) {
			// pray we find 'which'
			exports.subprocess(afs.exists('/usr/bin/which') ? '/usr/bin/which' : 'which', [ path ], function (err, stdout, stderr) {
				if (err) {
					callback();
				} else {
					finished(null, stdout.split('\n').shift().trim());
				}
			});
		}, 1);

	queue.drain = function () {
		// not found :(
		finished(null, null);
	};

	queue.push(paths.filter(function (p) { return !!p; }));
};





















