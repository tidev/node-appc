/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
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
	return path.resolve(p.replace(tildeRegExp, function(s, m, n) {
		return exports.home() + (n || '/');
	}).replace(winEnvVarRegExp, function(s, m, n) {
		return process.platform == 'win32' && process.env[n] || m;
	}));
};

exports.touch = function (p) {
	fs.utimesSync(p, Date.now(), Date.now());
};
