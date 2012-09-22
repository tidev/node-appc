/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var semver = require('semver');

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

// semver only likes to compare X.Y.Z formatted versions
exports.eq = function (v1, v2) { return semver.eq(exports.format(v1, 3, 3), exports.format(v2, 3, 3)); };
exports.lt = function (v1, v2) { return semver.lt(exports.format(v1, 3, 3), exports.format(v2, 3, 3)); };
exports.lte = function (v1, v2) { return semver.lte(exports.format(v1, 3, 3), exports.format(v2, 3, 3)); };
exports.gt = function (v1, v2) { return semver.gt(exports.format(v1, 3, 3), exports.format(v2, 3, 3)); };
exports.gte = function (v1, v2) { return semver.gte(exports.format(v1, 3, 3), exports.format(v2, 3, 3)); };