/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

exports.printDiff = function (from, to) {
	var delta = to - from,
		x,
		s = [];
	
	x = Math.floor(delta / (60 * 60 * 60 * 1000)),
	x && s.push(x + 'h');
	delta = delta % (60 * 60 * 60 * 1000);
	
	x = Math.floor(delta / (60 * 60 * 1000));
	x && s.push(x + 'm');
	delta = delta % (60 * 60 * 1000);
	
	x = Math.floor(delta / (60 * 1000));
	x && s.push(x + 's');
	delta = delta % (60 * 1000);
	
	delta && s.push(delta + 'ms');
	
	return s.join(' ');
};