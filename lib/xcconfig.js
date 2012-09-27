/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var fs = require('fs'),
	path = require('path'),
	afs = require('./fs');

function xcconfig(filename) {
	Object.defineProperty(this, 'load', {
		value: function (file) {
			if (!afs.exists(file)) {
				throw new Error('xcconfig file does not exist');
			}
			return this.parse(fs.readFileSync(file).toString());
		}
	});
	
	Object.defineProperty(this, 'parse', {
		value: function (str) {
			str.split('\n').forEach(function (line) {
				var p = line.indexOf('//');
				if (p != -1) {
					line = line.substring(0, p);
				}
				var parts = line.split(/(([^\[=]+)(\[[^\]]+\])?) *=? *(.+)/);
				if (parts.length >= 5) {
					this[parts[1].trim()] = parts[4].trim();
				}
			}, this);
			return this;
		}
	});
	
	filename && this.load(filename);
}

module.exports = xcconfig;
