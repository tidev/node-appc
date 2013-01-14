/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

/**
 * @classdesc Communication with studio is handled using a RESTful client-server architecture. The transport mechanism is pluggable
 * so that different transports can be swapped out without changing client code. Messages are passed inside of one or
 * more protocols. The top-level protocol is defined below, and any other parent/lower-level protocols are defined on a
 * transport by transport basis.
 * <pre>
 * Request:
 *		{
 *			messageType: [value],
 *			data: [value],
 *		}
 *
 *	messageType: always a string, and is the value of messageType supplied to {@link module:studiocomm/transport.listen} or {@link module:studiocomm/transport.send}
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
 * Note: a response must always sent, even if there is no data to send, because the message serves as a request ACK.
 * </pre>
 *
 * @constructor
 * @name module:studiocomm/transport
 */
module.exports = function () {};

/**
 * @method
 * @name module:studiocomm/transport~listenCallback
 * @param {Object} request The request object
 * @param {String} request.messageType The message type
 * @param {Any} request.data The data received, after having been parsed via JSON.parse
 * @param {module:studiocomm~listenCallbackResponse} response The response object
 */
/**
 * @method
 * @name module:studiocomm/transport~listenCallbackResponse
 * @param {String|undefined} error The error, if one occured. Anything falsey is understood to mean no error occured, and
 *		the value is converted to undefined
 * @param {Any|undefined} data The data, if any. The value is ignored if an error is supplied
 */
/**
 * Listens for a message from Studio
 *
 * @method
 * @name module:studiocomm/transport.listen
 * @param {String} messageType The name of the message to listen for
 * @param {module:studiocomm/transport~listenCallback} callback The callback to fire when a message arrives. The callback is passed
 *		two parameters: request and response
 */
exports.prototype.listen = function (messageType, callback) {
	if (!this._listeners[messageType]) {
		this._listeners[messageType] = [];
	}
	this._listeners[messageType].push(callback);
};

/**
 * @method
 * @name module:studiocomm/transport~sendCallback
 * @param {String|undefined} error The error message, if one occured, else undefined
 * @param {Any|undefined} data The data, if an error did not occur, else undefined
 */
/**
 * Sends a message to Studio
 *
 * @method
 * @name module:studiocomm/transport.send
 * @param {String|undefined} messageType The name of the message to send
 * @param {Any|undefined} data The data to send. Must be JSON.stringify-able (i.e. no cyclic structures). Can be primitive or
 *		undefined, although undefined is converted to null
 * @param {module:studiocomm/transport~sendCallback} callback The callback to fire once the transmission is complete or
 *		has errored. The error parameter is null if no error occured, or a string indicating the error. The data
 *		parameter is null if an error occured, or any type of data (including null) if no error occured.
 */
exports.prototype.send = function () {
	throw new Error('Attempted to call "send" for a transport without a send implementation');
};