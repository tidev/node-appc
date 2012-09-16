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
			sdkPath: process.env.ANDROID_SDK || '',
			targets: [],
			avds: {}
		},
		sdkPath;
	if (!result.sdkPath || !afs.exists(result.sdkPath)) {
		sdkPath = result.sdkPath = findSDK();
	}
	exe = result.exe = path.join(sdkPath, 'tools', process.platform == 'win32' ? 'android.exe' : 'android');
	
	async.parallel([
		
		function (next) {
			exec(exe + ' list targets', function(error, stdout, stderr) {
				var targets,
					target,
					line,
					key,
					value,
					match,
					keyValueRegex = /^[ ]*(.*): (.*)$/,
					idRegex = /^id: ([0-9]*) or "(.*)"$/,
					basedOnRegex = /^[ ]*Based on Android ([0-9\.]*) \(API level ([0-9]*)\)$/,
					libraryEntryRegex = /^[ ]*\* (.*) \((.*)\)/,
					dest,
					i, j, k;
				if (!error && !stderr) {
					targets = stdout.split('----------');
					targets.shift();
					for(i = 0; i < targets.length; i++) {
						target = targets[i].split('\n');
						j = 0;
						while(j < target.length) {
							line = target[j];
							if (line) {
								if (match = line.match(idRegex)) {
									dest = result.targets[match[1]] = {
										id: match[2]
									}
								} else if (match = line.match(keyValueRegex)) {
									if (match) {
										key = match[1].trim();
										value = match[2];
										switch(key) {
											case 'Description':
												dest[key] = value;
												// Parse the "Base on Android x (API x)" immediately following the desc
												j++;
												line = target[j];
												match = line.match(basedOnRegex);
												dest['Android Version'] = match[1];
												dest['API Level'] = match[2];
												break;
											case 'Skins':
											case 'ABIs':
												dest[key] = value.split(', ');
												break;
											default:
												dest[key] = value;
										}
									}
								} else if (line === '     Libraries:') {
									dest = dest['Libraries'] = {};
									while(match = target[++j].match(libraryEntryRegex)) {
										key = match[1];
										dest[key] = {
											jar: match[2],
											description: target[++j].trim()
										}
									}
								}
							}
							j++;
						}
					}
				}
				next();
			});
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