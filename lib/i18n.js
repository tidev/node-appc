/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var path = require('path'),
	fs = require('fs'),
	vsprintf = require('sprintf').vsprintf,
	locale = 'en',
	locales = {};

module.exports = function (dirname) {
	return new i18n(dirname);
};

function i18n(dirname) {
	
	var localesDir,
		initialDir = dirname;
	
	// Fetch the locales data
	if (locales[localesDir]) {
		return localesDir;
	} else {
		while (dirname.split(path.sep)[1]) {
			if (~fs.readdirSync(dirname).indexOf('locales')) {
				localesDir = path.join(dirname, 'locales');
				try {
					this.localeData = JSON.parse(fs.readFileSync(path.join(localesDir, locale + '.js')));
				} catch(e) {
					this.localeData = {};
				}
				break;
			}
			dirname = path.resolve(path.join(dirname, '..'));
		}
		if (!localesDir) {
			console.error('*** Locales folder not found for ' + initialDir + ' ***');
			process.exit(1);
		}
		locales[localesDir] = this.localeData;
	}

	// Hook up the __ method
	this.__ = function (message) {
		return vsprintf(this.localeData[message] || message, Array.prototype.slice.call(arguments, 1));
	}.bind(this);
	
	// Hook up the __n method
	this.__n = function(singularMessage, pluralMessage, count) {
		var message = this.localeData[singularMessage];
		if (parseInt(count, 10) > 1) {
			message = message ? message.other : pluralMessage;
		} else {
			message = message ? message.one : singularMessage;
		}
		return vsprintf(message, Array.prototype.slice.call(arguments, 3));
	}.bind(this);
}