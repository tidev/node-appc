/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var path = require('path'),
	fs = require('fs'),
	vsprintf = require('sprintf').vsprintf,
	locale,
	providers = {};

try {
	locale = JSON.parse(fs.readFileSync(path.join(
		process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'locale.json'))).language;
} catch(e) {
	locale = 'en-us';
}

module.exports = function (dirname) {
	
	var localesDir,
		initialDir = dirname;
	while (dirname.split(path.sep)[1]) {
		if (~fs.readdirSync(dirname).indexOf('locales')) {
			localesDir = path.join(dirname, 'locales');
			break;
		}
		dirname = path.resolve(path.join(dirname, '..'));
	}
	if (!localesDir) {
		return new i18n();
	}
	if (!providers[localesDir]) {
		providers[localesDir] = new i18n(localesDir);
	}
	return providers[localesDir];
};

module.exports.getLocale = function() {
	return locale;
}

function i18nString(original, translated) {
	this.original = original;
	this.translated = translated != void 0 ? translated : original;
}

i18nString.prototype.toString = function () {
	return this.translated;
};

function i18n(localesDir) {
	this.localeData = {};
	
	if (localesDir) {
		var localeFilePath = path.join(localesDir, locale + '.js');
		try {
			if (!fs.existsSync(localeFilePath)) {
				localeFilePath = path.join(localesDir, locale.split('-')[0] + '.js');
			}
			if (fs.existsSync(localeFilePath)) {
				this.localeData = JSON.parse(fs.readFileSync(localeFilePath));
			}
		} catch(e) {
			this.localeData = {};
		}
	}
	
	this.__ = function (message) {
		var msg = vsprintf(message, Array.prototype.slice.call(arguments, 1));
		if (this.localeData) {
			return new i18nString(
				msg,
				this.localeData[message] && vsprintf(this.localeData[message], Array.prototype.slice.call(arguments, 1))
			);
		} else {
			// this should never happen, but just in case the local file contains 0 or false
			return new i18nString(msg);
		}
	}.bind(this);
	
	this.__n = function(singularMessage, pluralMessage, count) {
		if (this.localeData) {
			var original,
				translated = this.localeData[singularMessage];
			if (parseInt(count, 10) > 1) {
				original = vsprintf(pluralMessage, [count]);
				translated = translated ? vsprintf(translated.other, [count]) : original;
			} else {
				original = vsprintf(singularMessage, [count]);
				translated = translated ? vsprintf(translated.one, [count]) : original;
			}
			return new i18nString(original, vsprintf(translated, Array.prototype.slice.call(arguments, 3)));
		} else {
			return new i18nString(
				vsprintf(parseInt(count, 10) > 1 ? pluralMessage : singularMessage, Array.prototype.slice.call(arguments, 3))
			);
		}
	}.bind(this);
}