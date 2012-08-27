/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Portions derived from wrench under the MIT license.
 * Copyright (c) 2010 Ryan McGrath
 * https://github.com/ryanmcgrath/wrench-js
 */

var fs = require('fs'),
	path = require('path'),
	tildeRegExp = /^(~)(\/.*)?$/,
	winEnvVarRegExp = /(%([^%]*)%)/g;

exports.home = function () {
	return process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'];
};

exports.exists = function (p) {
	// existsSync was moved from path to fs in node 0.8.0
	return (fs.existsSync || path.existsSync)(arguments.length > 1 ? path.join.apply(null, arguments) : p);
};

exports.resolvePath = function () {
	var p = path.join.apply(null, arguments);
	return path.resolve(p.replace(tildeRegExp, function (s, m, n) {
		return exports.home() + (n || '/');
	}).replace(winEnvVarRegExp, function (s, m, n) {
		return process.platform == 'win32' && process.env[n] || m;
	}));
};

exports.touch = function (file) {
	if (exports.exists(file)) {
		fs.utimesSync(file, Date.now(), Date.now());
	} else {
		fs.writeFileSync(file, '');
	}
};

exports.isDirWritable = function (dir) {
	var result = false,
		tmpFile = path.join(dir, 'tmp' + Math.round(Math.random() * 1e12));
	if (exports.exists(dir)) {
		try {
			exports.touch(tmpFile);
			result = exports.exists(tmpFile);
			fs.unlink(tmpFile);
		} catch (e) {}
	}
	return result;
};

exports.copyFileSync = function (src, dest, opts) {
	dest = path.join(dest, path.basename(src));
	opts && opts.logger && opts.logger(__('Copying %s => %s', src.cyan, dest.cyan));
	fs.writeFileSync(dest, fs.readFileSync(src));
};

exports.copyDirSyncRecursive = function(sourceDir, newDirLocation, opts, ignore) {
	opts && opts.logger && opts.logger(__('Copying %s => %s', sourceDir.cyan, newDirLocation.cyan));
	
	if (!opts || !opts.preserve) {
		try {
			fs.statSync(newDirLocation).isDirectory() && exports.rmdirSyncRecursive(newDirLocation);
		} catch(e) {}
	}
	
	//  Create the directory where all our junk is moving to; read the mode of the source directory and mirror it
	var checkDir = fs.statSync(sourceDir);
	try {
		fs.mkdirSync(newDirLocation, checkDir.mode);
	} catch (e) {
		// if the directory already exists, that's okay
		if (e.code !== 'EEXIST') {
			throw e;
		}
	}
	
	var files = fs.readdirSync(sourceDir);
	
	for (var i = 0; i < files.length; i++) {
		if (ignore && ignore.indexOf(files[i]) != -1) {
			continue;
		}
		
		var currFile = fs.lstatSync(sourceDir + '/' + files[i]);
		
		if (currFile.isDirectory()) {
			// recursion this thing right on back.
			exports.copyDirSyncRecursive(sourceDir + '/' + files[i], newDirLocation + '/' + files[i], opts);
		} else if (currFile.isSymbolicLink()) {
			var symlinkFull = fs.readlinkSync(sourceDir + '/' + files[i]);
			fs.symlinkSync(symlinkFull, newDirLocation + '/' + files[i]);
		} else {
			// At this point, we've hit a file actually worth copying... so copy it on over.
			var contents = fs.readFileSync(sourceDir + '/' + files[i]);
			fs.writeFileSync(newDirLocation + '/' + files[i], contents);
		}
	}
};
