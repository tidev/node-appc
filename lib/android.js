/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var exec = require('child_process').exec,
	async = require('async'),
	path = require('path'),
	util = require('./util'),
	fs = require('fs'),
	afs = require('./fs'),
	version = require('./version'),
	cached;

/*
	DEFAULT_API_LEVEL = 8,
	androidApiLevels = {
		3: 'android-1.5',
		4: 'android-1.6',
		5: 'android-2.0',
		6: 'android-2.0.1',
		7: 'android-2.1',
		8: 'android-2.2',
		9: 'android-2.3',
		10: 'android-2.3.3',
		11: 'android-3.0'
	};
*/

exports.detect = function (finished) {
	if (cached) return finished(cached);
	
	var result = {
		sdkPath: process.env.ANDROID_SDK || ''
	};
	
	async.parallel([
		function (next) {
			if (!result.sdkPath || !afs.exists(result.sdkPath)) {
				result.sdkPath = findSDK();
			}
			next();
		},
		
		function (next) {
			/*
			platform_dir = self.find_dir(self.api_level, os.path.join('platforms', 'android-'))
			if platform_dir is None:
				old_style_dir = os.path.join(self.android_sdk, 'platforms', android_api_levels[self.api_level])
				if os.path.exists(old_style_dir):
					platform_dir = old_style_dir
			if platform_dir is None:
				raise Exception("No \"%s\" or \"%s\" in the Android SDK" % ('android-%s' % self.api_level, android_api_levels[self.api_level]))
			self.platform_dir = platform_dir
			*/
			next();
		},
		
		function (next) {
			/*
			if 'GOOGLE_APIS' in os.environ:
				self.google_apis_dir = os.environ['GOOGLE_APIS']
				return self.google_apis_dir
			self.google_apis_dir = self.find_dir(self.api_level, os.path.join('add-ons', 'google_apis-'))
			if self.google_apis_dir is None:
				self.google_apis_dir = self.find_dir(self.api_level, os.path.join('add-ons', 'addon?google?apis?google*'))
			*/
			next();
		}
	], function () {
		finished(result);
	});
};

function findSDK() {
	var i,
		dirs = process.platform == 'win32'
			? ['C:\\android-sdk', 'C:\\android', 'C:\\Program Files\\android-sdk', 'C:\\Program Files\\android']
			: ['/opt/android', '/opt/android-sdk', '/usr/android', '/usr/android-sdk'],
		exe = process.platform == 'win32' ? 'android.exe' : 'android';
	
	for (i = 0; i < dirs.length; i++) {
		if (afs.exists(dirs[i])) {
			return dirs[i];
		}
	}
	
	dirs = (process.env.PATH || '').split(process.platform == 'win32' ? ';' : ':');
	for (i = 0; i < dirs.length; i++) {
		if (afs.exists(dirs[i].trim(), exe)) {
			return dirs[i];
		}
	}
}