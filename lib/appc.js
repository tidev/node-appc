/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */


/**
 * thank's to John Resig for this concise function 
 */
Array.prototype.remove = function(from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};

['fs', 'image', 'manifest', 'net', 'progress', 'string', 'util'].forEach(function (m) {
	exports[m.split('/').shift()] = require('./' + m);
});
