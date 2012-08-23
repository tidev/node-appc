/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

function AppcException(message) {
	this.type = 'AppcException';
	this.message = message;
}
AppcException.prototype = Error.prototype;

module.exports = AppcException;