/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var colors = require('colors');

exports.lpad = function (s, len, ch) {
	var pre = '',
		ns = String(s),
		i = colors.stripColors(ns).length;
	ch = ch || ' ';
	while (i++ < len) {
		pre += ch;
	}
	return pre + ns;
};

exports.rpad = function (s, len, ch) {
	var ns = String(s),
		i = colors.stripColors(ns).length;
	ch = ch || ' ';
	while (i++ < len) {
		ns += ch;
	}
	return ns;
};

exports.capitalize = function (s) {
	return s.substring(0, 1).toUpperCase() + s.substring(1);
};

// measures distance between words
exports.levenshtein = function (s, c) {
	var len1 = (s = s.split('')).length,
		len2 = (c = c.split('')).length,
		a = [],
		i = len1 + 1,
		j;
	
	if (!(len1 || len2)) {
		return Math.max(len1, len2);
	}
	for (; i; a[--i] = [i]);
	for (i = len2 + 1; a[0][--i] = i;);
	for (i = -1; ++i < len1;) {
		for(j = -1; ++j < len2;) {
			a[i + 1][j + 1] = Math.min(a[i][j + 1] + 1, a[i + 1][j] + 1, a[i][j] + (s[i] != c[j]));
		}
	}
	return a[len1][len2];
};
