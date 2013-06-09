/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */
 
var spawn = require('child_process').spawn,
	path = require('path'),
	
	wrench = require('wrench'),
	async = require('async'),
	
	fs = require('fs'),
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

exports.zip = function (target, result, options, callback) {
	var targets = [],
		child,
		cwd,
		stdout = '',
		stderr = '';

	if (!callback && typeof options == 'function') {
		callback = options;
		options = {};
	}
	if (target && target.length) {
		//target may contain path or array of parths, for each resolvePath called to fix pathes
		Array.isArray(target) || (target = [target]);
		target.forEach(function (file) {
			file && targets.push(afs.resolvePath(file));
		});		
	}
	if (!targets.length) {
		return callback('target must be a String or Array<String> of files');
	}
	cwd = afs.resolvePath(options.basePath || process.cwd());
	if (/\/$/.test(cwd)) {
		cwd = cwd.substring(0, cwd.length - 1);
	}
	if (process.platform === 'win32') {
		if (targets.length == 1 && afs.exists(targets[0]) && fs.statSync(targets[0]).isDirectory()) {
			//zip all files in current directory if target files list contains only one entry and it is doirectory
			child = spawn(path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe'), ['a', result, targets[0] + '/*', '-tzip']);
		} else {
			child = spawn(
				path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe'),
				['a', '-tzip', result].concat(targets.map(function (p) {
					var x = p.indexOf(cwd);
					if (x >= 0) {
						p = p.replace(cwd, '');
						if (/^(\/|\\)/.test(p)) {
							p = p.substring(1);
						}
					}
					if (!p) {
						p = '.';
					}
					return p;
				})),
				{ cwd : cwd });
		}

		child.stdout.on('data', function (data) {
			stdout += data.toString();
		});

		child.stderr.on('data', function (data) {
			stderr += data.toString();
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
		if (targets.length == 1 && afs.exists(targets[0]) && fs.statSync(targets[0]).isDirectory()) {
			//optimization for zipping one directory
			child = spawn('zip', ['-r', result, '.'], { cwd : targets[0] });
			
			child.stderr.on('data', function (data) {
				stderr += data.toString();
			});
			child.on('exit', function (code, signal) {
				if (callback) {
					if (code) {
						callback(stderr);
					} else {
						callback();
					}
				}
			});
		} else {
			child = spawn('zip', ['-r@', result], { cwd : cwd });

			child.stderr.on('data', function (data) {
				stderr += data.toString();
			});
			child.on('exit', function (code, signal) {
				if (callback) {
					if (code) {
						callback(stderr);
					} else {
						callback();
					}
				}
			});
			child.stdin.setEncoding = 'utf-8';
			child.stdin.end(targets.join('\n'));
		}
	}
};
