/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var fs = require('./fs');

exports.resize = function (params) {
	params = params || {};
	
	try {
		if (!params.source) throw new Error('Missing source');
		if (!fs.exists(params.source)) throw new Error('Source "' + params.source + '" does not exist');
		if (!params.dest) throw new Error('Missing dest');
		
		var dest = params.dest;
		Array.isArray(dest) || (dest = [dest]);
		
		var cmd = ['java -jar "' + require('path').resolve(module.filename, '..', '..', 'tools', 'resizer', 'resizer.jar') + '"', params.source];
		
		dest.forEach(function (d) {
			if (Object.prototype.toString.call(d) != '[object Object]') throw new Error('Invalid destination');
			if (!d.file) throw new Error('Missing destination file');
			
			var w = d.width | 0,
				h = d.height | 0;
			
			if (!w && !h) {
				throw new Error('Missing destination width and height');
			} else if (w && !h) {
				h = w;
			} else if (!w && h) {
				w = h;
			}
			
			cmd.push(d.file);
			cmd.push(w);
			cmd.push(h);
		});
		
		require('child_process').exec(cmd.join(' '), function (error, stdout, stderr) {
			params.callback && params.callback.call && params.callback(error == null, error ? new Error('Failed to resize images:\n' + stdout + '\n' + stderr) : void 0);
		});
	} catch (ex) {
		params.callback && params.callback.call && params.callback(false, ex);
	}
};
