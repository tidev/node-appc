/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

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
