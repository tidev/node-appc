/**
 * Performs authentication tasks including logging in the Appcelerator Network,
 * logging out, and checking session status.
 *
 * @module auth
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

exports.login = function login(_args) {};

exports.logout = function logout(_args) {};

exports.status = function status(_args) {
	return {
		loggedIn: true,
		uid: 0,
		guid: 0,
		email: '',
		cookie: ''
	};
};

exports.getMID = function getMID(_titaniumHomeDir, _callback) {};
