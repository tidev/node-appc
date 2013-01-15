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
 *			includes 0 padding if necessary. Hex letters must be lower case. Note: Response messages have the same
 *			Sequence ID as the request that generated the response
 *		Message Length: A 32-bit, base 16 number that identifies the length of the message. This value is always 8
 *			characters long, and includes 0 padding if necessary. Hex letters must be lower case.
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
var channels = {};

/**
 * @private
 */
module.exports = function (requestCallback) {
	var i;
	for(i = 1; i < 256; i++) {
		if (!channels[i]) {
			channels[i] = this;
			this._sequenceIDPrefix = i << 24;
			this._requestCallback = requestCallback;
			this._sequenceIDCount = 1;
			this._responseCallbacks = {};
			return;
		}
	}
	throw new Error('All stdio messaging channels are in use (max limit is 255).');
};

/**
 * @private
 */
module.exports.prototype.close = function () {
	var i;
	for(i = 0; i < 256; i++) {
		if (channels[i] === this) {
			delete channels[i];
		}
	}
};

/**
 * @private
 */
module.exports.prototype.send = function (data, callback) {
	var seqId = this._sequenceIDPrefix + (this._sequenceIDCount++),
		msg = 'REQ,' + (seqId < 0x10000000 ? '0' : '') + seqId.toString(16) + ',' + data.length + ',' + data;
	if (this._sequenceIDCount > 0xFFFFFF) {
		this._sequenceIDCount = 0;
	}
	process.stdout.write(msg);
	this._responseCallbacks[seqId] = function(data) {
		delete this._responseCallbacks[seqId];
		callback && callback(data);
	};
};