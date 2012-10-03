/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Portions derived from node-progress under the MIT license.
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * https://github.com/visionmedia/node-progress
 */

/*
 * This code is based on the node-progress package from TJ Holowaychuk. This version fixes some bugs and adds new features. 
 * Below is the original disclaimer:
 * node-progress
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */
 
var string = require('./string'),
	util = require('./util');

var ProgressBar = exports = module.exports = function (fmt, options) {

	options = options || {};
	if ('string' != typeof fmt) throw new Error('format required');
	if ('number' != typeof options.total) throw new Error('total required');
	this.fmt = fmt;
	this.curr = 0;
	this.total = options.total;
	this.width = options.width || this.total;

	this.chars = {
		complete: options.complete || '=',
		incomplete: options.incomplete || '-'
	};
}	

ProgressBar.prototype.tick = function (len, tokens) {
	
	if (len !== 0) {
		len = len || 1;
	}

	// swap tokens
	if ('object' == typeof len) {
		tokens = len;
		len = 1;
	}

	// start time for eta
	if (0 == this.curr) {
		this.start = new Date;
	}

	// progress complete
	if ((this.curr += len) > this.total) {
		this.complete = true;
		return;
	}
	
	var percent = this.curr / this.total * 100,
		complete = Math.round(this.width * (this.curr / this.total)),
		incomplete = this.width - complete,
		elapsed = new Date - this.start,
		eta = elapsed * (this.total / this.curr - 1),
		rl;
	complete = Array(complete + 1).join(this.chars.complete);
	incomplete = Array(incomplete + 1).join(this.chars.incomplete);

	// The extra space at the end prevents shrinking progress bars from ghosting
	var str = this.fmt
		.replace(':bar', complete + incomplete)
		.replace(':current', this.curr)
		.replace(':total', this.total)
		.replace(':elapsed', (elapsed / 1000).toFixed(1))
		.replace(':eta', (eta / 1000).toFixed(1))
		.replace(':percent', percent.toFixed(0) + '%')
		.replace(':paddedPercent', string.lpad(percent.toFixed(0) + '%', 4)) + ' ';

	if (tokens) {
		for (var key in tokens) {
			str = str.replace(':' + key, tokens[key]);
		}
	}
		
	if (str != this.str) {
		this.str = str;
		if (!this.writePending) {
			this.writePending = true;
			setTimeout(function () {
				this.writePending = false;
				process.stdout.cursorTo(0);
				process.stdout.write(this.str);
			}.bind(this), 30);
		}
	}
};
