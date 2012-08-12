/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

exports.mix = function (dest) {
	var i = 1,
		l = arguments.length,
		p,
		src;
	dest || (dest = {});
	while (i < l) {
		src = arguments[i++];
		for (p in src) {
			src.hasOwnProperty(p) && (dest[p] = src[p]);
		}
	}
	return dest;
};
