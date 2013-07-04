/**
 * Less restrictive semantic version comparision.
 *
 * @module version
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var semver = require('semver');

/**
 * Formats a version based on a minimum and maximum number of segments.
 * @param {String} ver - The version
 * @param {Number} [min] - The minimum number of segments
 * @param {Number} [max] - The maximum number of segments
 * @returns {String} The formatted version
 */
var format = exports.format = function format(ver, min, max) {
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

/**
 * Converts two versions into 3 segment format, then checks if they are equal to each other.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the versions are equal
 */
exports.eq = function eq(v1, v2) {
	return semver.eq(format(v1, 3, 3), format(v2, 3, 3));
};

/**
 * Converts two versions into 3 segment format, then checks if the first version is less than the
 * second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is less than the second version
 */
exports.lt = function lt(v1, v2) {
	return semver.lt(format(v1, 3, 3), format(v2, 3, 3));
};

/**
 * Converts two versions into 3 segment format, then checks if the first version is less than or
 * equal to the second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is less than or equal to the second version
 */
exports.lte = function lte(v1, v2) {
	return semver.lte(format(v1, 3, 3), format(v2, 3, 3));
};

/**
 * Converts two versions into 3 segment format, then checks if the first version is greater than the
 * second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is greater than the second version
 */
exports.gt = function gt(v1, v2) {
	return semver.gt(format(v1, 3, 3), format(v2, 3, 3));
};

/**
 * Converts two versions into 3 segment format, then checks if the first version is greater than or
 * equal to the second version.
 * @param {String} v1 - The first version to compare
 * @param {String} v2 - The second version to compare
 * @returns {Boolean} True if the first version is greater than or equal to the second version
 */
exports.gte = function (v1, v2) {
	return semver.gte(format(v1, 3, 3), format(v2, 3, 3));
};
