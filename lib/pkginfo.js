/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Portions derived from pkginfo under the MIT license.
 * Copyright (c) 2010 Charlie Robbins.
 * https://github.com/indexzero/node-pkginfo
 */

var fs = require('fs'),
	path = require('path'),
	data = {};

function find(pmodule, dir, filename) {
	dir = dir || pmodule.filename;
	dir = path.dirname(dir); 
	
	var files = fs.readdirSync(dir);
	
	if (~files.indexOf(filename)) {
		return path.join(dir, filename);
	}
	
	if (dir === '/') {
		throw new Error('Could not find ' + filename + ' up from: ' + dir);
	} else if (!dir || dir === '.') {
		throw new Error('Cannot find ' + filename + ' from unspecified directory');
	}
	
	return find(pmodule, dir, filename);
}

function runner(pmodule, filename) {
	if (data[filename]) {
		return data[filename];
	}
	
	try {
		var dir = find(pmodule, null, filename);
		data[filename] = dir && fs.readFileSync(dir).toString();
		data[filename] = JSON.parse(data[filename]) || {};
	} catch(ex) {
		data[filename] = {};
	}
	
	return data[filename];
};

exports.manifest = function (pmodule) {
	return runner(pmodule, 'manifest.json');
};

exports.package = function (pmodule) {
	var keepers = Array.prototype.slice.call(arguments, 1),
		results = runner(pmodule, 'package.json');
	
	keepers.length && Object.keys(results).forEach(function (k) {
		if (keepers.indexOf(k) == -1) {
			delete results[k];
		}
	});
	
	return results;
};
