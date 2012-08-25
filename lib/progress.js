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
 * The purpose of this file is to overload the ProgressBar's tick() function to
 * a) support padded percentages and
 * b) properly draw the correct number of ticks in the bar, esp once it hits 100%
 */

var ProgressBar = exports = module.exports = require('progress'),
	string = require('./string'),
	last;

ProgressBar.prototype.tick = function (len, tokens) {
	if (len !== 0) len = len || 1;
	
	// swap tokens
	if ('object' == typeof len) tokens = len, len = 1;
	
	// start time for eta
	if (0 == this.curr) this.start = new Date;
	
	// progress complete
	if ((this.curr += len) > this.total) {
		this.complete = true;
		this.stream.write('\r\033[2K');
		return;
	}
	
	var percent = this.curr / this.total * 100,
		complete = Math.round(this.width * (this.curr / this.total)),
		incomplete = this.width - complete,
		elapsed = new Date - this.start,
		eta = elapsed * (this.total / this.curr - 1);
	
	complete = Array(complete + 1).join(this.chars.complete);
	incomplete = Array(incomplete + 1).join(this.chars.incomplete);
	
	var str = this.fmt
		.replace(':bar', complete + incomplete)
		.replace(':current', this.curr)
		.replace(':total', this.total)
		.replace(':elapsed', (elapsed / 1000).toFixed(1))
		.replace(':eta', (eta / 1000).toFixed(1))
		.replace(':percent', percent.toFixed(0) + '%')
		.replace(':paddedPercent', string.lpad(percent.toFixed(0) + '%', 4));
	
	if (tokens) {
		for (var key in tokens) {
			str = str.replace(':' + key, tokens[key]);
		}
	}
	
	str != last && this.stream.write('\r\033[2K' + str);
	last = str;
};
