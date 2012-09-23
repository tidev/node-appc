/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */
 
var exec = require('child_process').exec,
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
	var cmd = process.platform === 'win32' ? 
		path.resolve(module.filename, '..', '..', 'tools','7zip', '7za.exe') + ' x "' + filename + '" -o"' + destinationDir + '" -y -bd' :
		'unzip -o -qq "' + filename + '" -d "' + destinationDir + '"';
	exec(cmd, function (err, stdout, stderr) {
		callback && callback(err ? 'Error ' + err + ': ' + stderr.toString() : undefined);
	});
};