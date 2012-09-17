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

exports.detect = function (finished) {
	if (cached) return finished(cached);
	
	var result = {
			sdkPath: process.env.ANDROID_SDK || '',
			targets: [],
			avds: []
		},
		sdkPath;
	if (!result.sdkPath || !afs.exists(result.sdkPath)) {
		sdkPath = result.sdkPath = findSDK();
	}
	exe = result.exe = path.join(sdkPath, 'tools', process.platform == 'win32' ? 'android.exe' : 'android');
	
	async.parallel([
		
		function (next) {
			exec(exe + ' list targets', function (error, stdout, stderr) {
				var targets,
					target,
					line,
					key,
					value,
					match,
					keyValueRegex = /^(.*):(.*)$/,
					idRegex = /^id: ([0-9]*) or "(.*)"$/,
					basedOnRegex = /Based on Android ([0-9\.]*) \(API level ([0-9]*)\)$/,
					libraryEntryRegex = /^[ ]*\* (.*) \((.*)\)/,
					manifestNameRegex = /^name=(.*)$/m,
					manifestVendorRegex = /^vendor=(.*)$/m,
					manifestApiRegex = /^api=(.*)$/m,
					manifestRevisionRegex = /^revision=(.*)$/m,
					dest,
					i, j, k,
					targetDirs = [];
				if (!error && !stderr) {
					targets = stdout.split('----------');
					targets.shift(); // Remove the header

					// Process the targets
					for(i = 0; i < targets.length; i++) {
						target = targets[i].split('\n');
						j = 0;

						// Parse the target
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
										value = match[2].trim();
										switch(key) {
											case 'Description':
												dest[key] = value;
												// Parse the "Base on Android x (API x)" immediately following the desc
												j++;
												line = target[j];
												match = line.match(basedOnRegex);
												dest['Based On'] = {
													'Android Version': match[1],
													'API Level': match[2]
												}
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
									dest['Libraries'] = {};
									while(match = target[++j].match(libraryEntryRegex)) {
										key = match[1];
										dest['Libraries'][key] = {
											jar: match[2],
											description: target[++j].trim()
										}
									}
								}
							}
							j++;
						}
					}

					// Create the list of target directories and their properties
					afs.visitDirsSync(path.join(sdkPath, 'add-ons'), function(subDir, subDirPath) {
						var manifest = fs.readFileSync(path.join(subDirPath, 'manifest.ini')).toString();
						targetDirs.push({
							dirPath: subDirPath,
							name: manifest.match(manifestNameRegex)[1],
							vendor: manifest.match(manifestVendorRegex)[1],
							api: manifest.match(manifestApiRegex)[1],
							revision: manifest.match(manifestRevisionRegex)[1]
						});
					});

					// Find the paths for the target
					targets = result.targets;
					for(i = 0; i < targets.length; i++) {
						dest = targets[i];
						if (dest) {
							if (dest['Type'] === 'Platform') {
								dest.Path = path.join(sdkPath, 'platforms', dest['id']);
							} else if (dest['Type'] === 'Add-On') {
								for(j = 0; j < targetDirs.length; j++) {
									if (targetDirs[j].name === dest['Name'] && targetDirs[j].vendor === dest['Vendor'] && 
											targetDirs[j].revision === dest['Revision']) {
										dest.Path = targetDirs[j].dirPath;
										break;
									}
								}
							}
						}
					}
				}
				next();
			});
		},

		function (next) {
			exec(exe + ' list avd', function (error, stdout, stderr) {
				var avds,
					avd,
					line,
					key,
					value,
					match,
					keyValueRegex = /^(.*):(.*)$/,
					basedOnRegex = /Based on Android ([0-9\.]*) \(API level ([0-9]*)\)$/,
					dest,
					i, j, k;

				if (!error && !stderr) {
					avds = stdout.split('---------');
					avds[0] = avds[0].substring(avds[0].indexOf('\n')); // Remove the header
					for(i = 0; i < avds.length; i++) {
						avd = avds[i].split('\n');
						dest = result.avds[i] = {};
						j = 0;
						while(j < avd.length) {
							line = avd[j];
							if (line && (match = line.match(keyValueRegex))) {
								key = match[1].trim();
								value = match[2].trim();
								while (avd[++j] && !avd[j].match(keyValueRegex)) {
									if (match = avd[j].match(basedOnRegex)) {
										dest['Based On'] = {
											'Android Version': match[1],
											'API Level': match[2]
										}
									} else {
										value += '\n' + avd[j];
									}
								}
								dest[key] = value;
							} else {
								j++;
							}
						}
					}
				}
				next();
			});
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