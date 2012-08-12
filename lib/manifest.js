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
	data;

function find(pmodule, dir) {
	dir = dir || pmodule.filename;
	dir = path.dirname(dir); 
	
	var files = fs.readdirSync(dir);
	
	if (~files.indexOf('manifest.json')) {
		return path.join(dir, 'manifest.json');
	}
	
	if (dir === '/') {
		throw new Error('Could not find manifest.json up from: ' + dir);
	} else if (!dir || dir === '.') {
		throw new Error('Cannot find manifest.json from unspecified directory');
	}
	
	return find(pmodule, dir);
}

module.exports = function (pmodule) {
	if (data) {
		return data;
	}
	
	try {
		var dir = find(pmodule);
		data = dir && fs.readFileSync(dir).toString();
		data = JSON.parse(data) || {};
	} catch(ex) {
		data = {};
	}
	
	return data;
};
