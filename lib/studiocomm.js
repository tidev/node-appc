/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * @module studiocomm
 */

/**
 * Creates a studio communication channel
 *
 * @method
 * @param {String} transport The transport channel to use. Right now, only 'stdio' is supported
 * @returns {module:studiocomm#Transport} The newly created transport
 */
exports.createTransport = function (transportType) {
	switch(transportType) {
		case 'stdio':
			return new StdioTransport();
		default:
			throw new Error('Invalid studio communication transport "' + transportType + '"');
	}
};

/**
 * @classdesc A transport instance provides a communication channel for talking with Studio
 *
 * <pre>
 * Data Format:
 * Request:
 *		{
 *			messageType: [value],
 *			data: [value],
 *		}
 *
 *	messageType: always a string, and is the value of messageType supplied to {@link module:studiocomm#Transport.listen} or {@link module:studiocomm#Transport.send}
 *	data: any valid JSON value
 *
 * Response:
 *
 *		{
 *			error: [value]
 *		}
 *
 *		or
 *
 *		{
 *			data: [value]
 *		}
 *
 *	error: error is a string if an error occured, null otherwise
 *	data: any valid JSON value
 * </pre>
 *
 * @constructor
 * @name module:studiocomm#Transport
 */
function Transport () {
	this._sendQueue = [];
}

/**
 * @method
 * @name module:studiocomm#Transport~listenCallback
 * @param {Object} request The request object
 * @param {String} request.messageType The message type
 * @param {Any} request.data The data received, after having been parsed via JSON.parse
 * @param {module:studiocomm~listenCallbackResponse} response The response object
 */
/**
 * @method
 * @name module:studiocomm#Transport~listenCallbackResponse
 * @param {String|undefined} error The error, if one occured
 * @param {Any|undefined} data The data, if any. Undefined if an error occured
 */
/**
 * Listens for a message from Studio
 *
 * @method
 * @name module:studiocomm#Transport.listen
 * @param {String} messageType The name of the message to listen for
 * @param {module:studiocomm#Transport~listenCallback} callback The callback to fire when a message arrives. The callback is passed
 *		two parameters: request and response
 */
transport.prototype.listen = function (messageType, callback) {};

/**
 * @method
 * @name module:studiocomm#Transport~sendCallback
 * @param {String|undefined} error The error message, if one occured, else null
 * @param {Any|undefined} data The data, if an error did not occur, else null
 */
/**
 * Sends a message to Studio
 *
 * @method
 * @name module:studiocomm#Transport.send
 * @param {String} messageType The name of the message to send
 * @param {Any} data The data to send. Must be JSON.stringify-able (i.e. no cyclic structures). Can be primitive or
 *		undefined, although undefined is converted to null
 * @param {module:studiocomm#Transport~sendCallback} callback The callback to fire once the transmission is complete or
 *		has errored. The error parameter is null if no error occured, or a string indicating the error. The data
 *		parameter is null if an error occured, or any type of data (including null) if no error occured.
 */
transport.prototype.send = function (messageType, data, callback) {};

/**
 * @classdesc A transport that uses stdin and stdout as the communications channel
 * <pre>
 * Low Level Packet format:
 * Request:
 *	[Message Type],[Sequence ID],[Message Length],[data]
 *		MessageType: The character sequence 'REQ'
 *		Sequence ID: A 32-bit, base 16 number that identifies the message. This value is always 8 characters long, and
 *			includes 0 padding if necessary
 *		Message Length: A 32-bit, base 16 number that identifies the length of the message. This value is always 8
 *			characters long, and includes 0 padding if necessary
 *	Example: REQ,000079AC,0000000C,{foo: 'bar'}
 *
 * Response:
 *	[Message Type],[Sequence ID],[Message Length],[data]
 *		MessageType: The character sequence 'RES'
 *		Sequence ID: A 32-bit, base 16 number that identifies the message. This value is always 8 characters long, and
 *			includes 0 padding if necessary. This is the same number as the request message ID.
 *		Message Length: A 32-bit, base 16 number that identifies the length of the message. This value is always 8
 *			characters long, and includes 0 padding if necessary
 *	Example: RES,000079AC,0000000C,{foo: 'baz'}
 * <pre>
 *
 * @constructor
 * @extends {module:studiocomm#Transport}
 */
function StdioTransport() {
	Transport.protoype.call(this);
}
StdioTransport.prototype = new Transport();