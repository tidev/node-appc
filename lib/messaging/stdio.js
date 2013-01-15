/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * <p>A transport that uses stdin and stdout as the communications channel. A low-level packet format, defined below, is
 * used to ensure proper message delivery.
 * <pre>
 *	[Message Type],[Sequence ID],[Message Length],[data]
 *		MessageType: A three character sequence that is either 'REQ' (request) or 'RES' (response)
 *		Sequence ID: A 32-bit, base 16 number that identifies the message. This value is always 8 characters long, and
 *			includes 0 padding if necessary. Note: Response messages have the same Sequence ID as the request that
 *			generated the response
 *		Message Length: A 32-bit, base 16 number that identifies the length of the message. This value is always 8
 *			characters long, and includes 0 padding if necessary
 *	Example: REQ,000079AC,0000000C,{foo: 'bar'}
 *	Example: RES,000079AC,0000000C,{foo: 'baz'}
 * <pre>
 * </p>
 *
 * @module messaging/stdio
 */

/**
 * @private
 */
var sequenceIDPrefixCount = 1;

/**
 * @private
 */
module.exports = function (requestCallback) {
	this._sequenceIDPrefix = (sequenceIDPrefixCount++) << 28;
	this._requestCallback = requestCallback;
	this._sequenceIDCount = 1;
};

/**
 * @private
 */
module.exports.prototype.close = function () {

};

/**
 * @private
 */
module.exports.prototype.send = function (data, callback) {
	var seqId = this._sequenceIDPrefix + (this._sequenceIDCount++),
		msg = 'REQ,' + seqId.toString(16) + ',' + data.length + ',' + data;
	process.stdout.write(msg);
};