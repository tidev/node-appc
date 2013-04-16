/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */
 
var spawn = require('child_process').spawn,
	exec = require('child_process').exec,
	path = require('path'),
	
	wrench = require('wrench'),
	async = require('async'),
	
	afs = require('./fs');
 
exports.unzip = function (filename, destinationDir, callback) {
	var errors = 0,
		tasks = [],
		ticks = 0,
		totalTicks;
	
	// Create the destination directory if it doesn't exist
	if (!afs.exists(destinationDir)) {
		wrench.mkdirSyncRecursive(destinationDir);
	}
	
	// Create the tasks to unzip each entry in the zip file
	var child,
		stdout = '',
		stderr = '';
	
	if (process.platform === 'win32') {
		child = spawn(path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe'), ['x', filename, '-o' + destinationDir, '-y', '-bd']);
		
		child.stdout.on('data', function (data) {
			stdout += data.toString();
		});
	} else {
		child = spawn('unzip', ['-o', '-qq', filename, '-d', destinationDir]);
	}
	
	child.stderr.on('data', function (data) {
		stderr += data.toString();
	});
	
	child.on('exit', function (code, signal) {
		if (callback) {
			if (code) {
				// if we're on windows, the error message is actually in stdout, so scan for it
				if (process.platform === 'win32') {
					var foundError = false,
						err = [];
					
					stdout.split('\n').forEach(function (line) {
						if (/^Error\:/.test(line)) {
							foundError = true;
						}
						if (foundError) {
							line && err.push(line.trim());
						}
					});
					
					if (err.length) {
						stderr = err.join('\n') + stderr;
					}
				}
				callback(stderr);
			} else {
				callback();
			}
		}
	});
};

exports.zipDirContent = function (targetDir, resultArc, callback) {
	if (process.platform === 'win32') {
		var child,
			stdout = '',
			stderr = '';

		child = spawn(path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe'), ['a', resultArc, targetDir + '/*', '-tzip']);
		child.stdout.on('data', function (data) {
			stdout += data.toString();
		});
		child.on('exit', function (code, signal) {
			if (callback) {
				if (code) {
					// the error message is actually in stdout, so scan for it
					var foundError = false,
						err = [];
					
					stdout.split('\n').forEach(function (line) {
						if (/^Error\:/.test(line)) {
							foundError = true;
						}
						if (foundError) {
							line && err.push(line.trim());
						}
					});

					if (err.length) {
						stderr = err.join('\n') + stderr;
					}
					callback(stderr);
				} else {
					callback();
				}
			}
		});
	} else {		
		exec(
			'zip -r "' + resultArc + '" *',
			{ cwd: targetDir },
			function (err, stdout, stderr) {
				callback(stderr);
			}
		);
	}
};