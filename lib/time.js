/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

exports.prettyDiff = function (from, to, opts) {
	var delta = to - from,
		x,
		s = [];
	
	opts = opts || {};
	
	x = Math.floor(delta / (24 * 60 * 60 * 1000)),
	x && s.push((opts.colorize ? ('' + x).cyan : x) + (opts.showFullName ? x === 1 ? ' day' : ' days' : 'd'));
	delta = delta % (24 * 60 * 60 * 1000);
	
	x = Math.floor(delta / (60 * 60 * 1000)),
	x && s.push((opts.colorize ? ('' + x).cyan : x) + (opts.showFullName ? x === 1 ? ' hour' : ' hours' : 'h'));
	delta = delta % (60 * 60 * 1000);
	
	x = Math.floor(delta / (60 * 1000));
	x && s.push((opts.colorize ? ('' + x).cyan : x) + (opts.showFullName ? x === 1 ? ' minute' : ' minutes' : 'm'));
	delta = delta % (60 * 1000);
	
	x = Math.floor(delta / 1000);
	x && s.push((opts.colorize ? ('' + x).cyan : x) + (opts.showFullName ? x === 1 ? ' second' : ' seconds' : 's'));
	delta = delta % 1000;
	
	if (!opts.hideMS && (s.length == 0 || delta)) {
		 s.push(delta + 'ms');
	}
	
	return s.join(' ');
};

exports.timestamp = function () {
	return (new Date).toISOString().replace('Z', "+0000");
};
