/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Dojo Toolkit
 * Copyright (c) 2005-2011, The Dojo Foundation
 * New BSD License
 * <http://dojotoolkit.org>
 */

/**
 * Mixes multiple objects into a single object.
 * @param {Object} dest - The object to mix the remaining arguments into
 * @returns {Object} Returns the mixed in object, which is also the original destination
 */
exports.mix = function mix(dest) {
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

/**
 * Mixes two objects together.
 * @param {Object} src - The object to copy from
 * @param {Object} dest - The object where the values are merged
 * @returns {Object} Returns the mixed in object
 */
exports.mixObj = function mixObj(src, dest) {
	Object.keys(src).forEach(function (prop) {
		if (!/^\+/.test(prop)) {
			if (Object.prototype.toString.call(src[prop]) == '[object Object]') {
				dest.hasOwnProperty(prop) || (dest[prop] = {});
				mixObj(src[prop], dest[prop]);
			} else if (Array.isArray(dest[prop])) {
				dest[prop] = dest[prop].concat(src[prop]);
			} else {
				dest[prop] = src[prop];
			}
		}
	});
	return dest;
};

function toArray(obj, offset) {
	return [].concat(Array.prototype.slice.call(obj, offset||0));
}

function hitchArgs(scope, method) {
	var pre = toArray(arguments, 2),
		named = typeof method == 'string';
	return function() {
		var s = scope || global,
			f = named ? s[method] : method;
		return f && f.apply(s, pre.concat(toArray(arguments)));
	};
}

exports.hitch = function (scope, method) {
	if (arguments.length > 2) {
		return hitchArgs.apply(global, arguments);
	}
	if (!method) {
		method = scope;
		scope = null;
	}
	if (typeof method == 'string') {
		scope = scope || global;
		if (!scope[method]) {
			throw(['hitch: scope["', method, '"] is null (scope="', scope, '")'].join(''));
		}
		return function() {
			return scope[method].apply(scope, arguments || []);
		};
	}
	return !scope ? method : function() {
		return method.apply(scope, arguments || []);
	};
};
