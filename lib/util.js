/**
 * Misc utilities.
 *
 * @module util
 *
 * @copyright
 * Copyright (c) 2009-2020 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

/**
 * Mixes multiple objects into a single object.
 * @param {Object} dest - The object where the values are merged
 * @param {Object[]} [args] - The objects to mix in
 * @returns {Object} The mixed object, which is also the original destination
 */
exports.mix = function mix(dest, ...args) {
	dest || (dest = {});
	const l = args.length;
	for (let i = 0; i < l; i++) {
		const src = args[i];
		for (const p in src) {
			(!src.hasOwnProperty || Object.prototype.hasOwnProperty.call(src, p)) && (dest[p] = src[p]);
		}
	}
	return dest;
};

/**
 * Deep mixes multiple objects into a single object.
 * @param {Object} dest - The object where the values are merged
 * @param {Object[]} [args] - The objects to mix in
 * @returns {Object} The mixed object, which is also the original destination
 */
exports.mixObj = function mixObj(dest, ...args) {
	dest || (dest = {});
	const l = args.length;
	for (let i = 0; i < l; i++) {
		mixer(dest, args[i]);
	}
	return dest;
};

/**
 * Mixes one object into another.
 * @param {Object} dest - The destination
 * @param {*} src - The source
 * @private
 */
function mixer(dest, src) {
	Object.keys(src).forEach(function (prop) {
		if (!/^\+/.test(prop)) {
			if (Object.prototype.toString.call(src[prop]) === '[object Object]') {
				Object.prototype.hasOwnProperty.call(dest, prop) || (dest[prop] = {});
				mixer(dest[prop], src[prop]);
			} else if (Array.isArray(dest[prop])) {
				dest[prop] = dest[prop].concat(src[prop]);
			} else {
				dest[prop] = src[prop];
			}
		}
	});
}
