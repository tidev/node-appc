/**
 * Queues and sends analytics data to the Appcelerator cloud.
 *
 * @module analytics
 *
 * @copyright
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';
var analyticsEvents = [];

exports.events = analyticsEvents;

exports.addEvent = function addEvent(_name, _data, _type) {};

exports.send = function send(_args, _callback) {
	_callback(null, null);
};
