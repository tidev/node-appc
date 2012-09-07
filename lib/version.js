/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

exports.format = function (ver, min, max) {
	ver = ('' + (ver || 0)).split('.');
	if (min != void 0) {
		while (ver.length < min) {
			ver.push('0');
		}
	}
	if (max != void 0) {
		ver = ver.slice(0, max);
	}
	return ver.join('.');
};