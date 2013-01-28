/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

/**
 * thank's to John Resig for this concise function
 */
Array.prototype.remove = function (from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};

if (!global.dump) {
	var util = require('util');
	global.dump = function () {
		for (var i = 0; i < arguments.length; i++) {
			console.error(util.inspect(arguments[i], false, null, true));
		}
	};
}

[	'analytics',
	'android',
	'async',
	'auth',
	'encoding',
	'environ',
	'exception',
	'fs',
	'image',
	'i18n',
	'ios',
	'messaging',
	'net',
	'pkginfo',
	'plist',
	'progress',
	'string',
	'time',
	'timodule',
	'tiplugin',
	'util',
	'version',
	'xcconfig',
	'xml',
	'zip'
].forEach(function (m) {
	exports[m.split('/').shift()] = require('./' + m);
});
