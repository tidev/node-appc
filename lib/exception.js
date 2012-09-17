/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var sprintf = require('sprintf').sprintf;

function AppcException(message, details) {
	this.type = 'AppcException';
	this.message = message;
	this.details = details ? (Array.isArray(details) ? details : [details]) : [];
}
AppcException.prototype = Error.prototype;

AppcException.prototype.log = function () {
	this.details.push(sprintf.apply(null, Array.prototype.slice.call(arguments)));
};

AppcException.prototype.dump = function (logger) {
	if (logger) {
		logger.error(this.message);
		this.details.forEach(logger.log);
	}
};

module.exports = AppcException;