/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var ELEMENT_NODE = exports.ELEMENT_NODE = 1;

exports.forEachElement = function (node, fn) {
	var child = node.firstChild;
	while (child) {
		if (child.nodeType == ELEMENT_NODE) {
			fn(child);
		}
		child = child.nextSibling;
	}
};

exports.getAttr = function (node, attr) {
	return node && exports.parse(node.getAttribute(attr));
};

exports.getValue = function (node) {
	return node && node.firstChild ? exports.parse(node.firstChild.data) : '';
};

exports.parse = function (value) {
	var num = Number(value);
	if (value === '' || typeof value !== 'string' || isNaN(num)) {
		value = value == void 0 ? '' : value.toString().trim();
		value === 'null' && (value = null);
		value === 'true' && (value = true);
		value === 'false' && (value = false);
		return value;
	}
	return num;
};
