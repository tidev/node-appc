/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */
 
var spawn = require('child_process').spawn,
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
	var child = process.platform === 'win32' ?
			spawn(path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe'), ['x', '"' + filename + '"', '-o"' + destinationDir + '"', '-y', '-bd']) :
			spawn('unzip', ['-o', '-qq', filename, '-d', destinationDir]),
		stderr = '';
	
	child.stderr.on('data', function (data) {
		stderr += data;
	});
	
	child.on('exit', function (code, signal) {
		callback && callback(code && stderr);
	});
};