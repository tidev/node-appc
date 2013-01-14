/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * <pre>
 * Low Level Packet format:
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
 *
 * @module studiocomm/stdio
 */

/**
 * @classdesc A transport that uses stdin and stdout as the communications channel
 *
 * @constructor
 * @extends {module:studiocomm#Transport}
 */
function StdioTransport() {
	Transport.protoype.call(this);
}
StdioTransport.prototype = new Transport();