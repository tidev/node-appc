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
	plist = require('./plist'),
	version = require('./version'),
	cached;

exports.detect = function (finished, opts) {
	if (process.platform != 'darwin') return finished();
	if (cached) return finished(cached);
	
	opts = opts || {};
	
	async.parallel([
		function (callback) {
			var searchDirs = ['/Developer'],
				xcodeInfo = {},
				xcodeBuildTasks = [];
			
			// first we build up a full list of places to check for xcodebuild
			fs.lstatSync('/Applications').isDirectory() && fs.readdirSync('/Applications').forEach(function (dir) {
				/^Xcode.*\.app$/.test(dir) && searchDirs.push('/Applications/' + dir + '/Contents/Developer');
			});
			fs.lstatSync('/Volumes').isDirectory() && fs.readdirSync('/Volumes').forEach(function (dir) {
				var vol = '/Volumes/' + dir;
				searchDirs.push(vol + '/Developer');
				afs.exists(vol + '/Applications') && fs.lstatSync(vol + '/Applications').isDirectory() && fs.readdirSync(vol + '/Applications').forEach(function (dir) {
					/^Xcode.*\.app$/.test(dir) && searchDirs.push(vol + '/Applications/' + dir + '/Contents/Developer');
				});
			});
			
			// TODO: try to use spotlight to find additional Xcode locations: "mdfind kMDItemDisplayName==Xcode&&kMDItemKind==Application"
			
			exec('xcode-select -print-path', function (err, stdout, stderr) {
				var selected = err ? '' : stdout.trim(),
					sdkRegExp = /^iPhone(OS|Simulator)(.+)\.sdk$/;
				
				function getSDKs() {
					var dir = path.join.apply(null, Array.prototype.slice.call(arguments)),
						vers = [];
					
					afs.exists(dir) && fs.readdirSync(dir).forEach(function (d) {
						if (fs.lstatSync(path.join(dir, d)).isDirectory()) {
							var m = d.match(sdkRegExp);
							m && (!opts.minSDK || version.gte(m[2], opts.minSDK)) && vers.push(m[2]);
						}
					});
					
					return vers;
				}
				
				async.parallel(searchDirs.sort().map(function (dir) {
					return function (cb) {
						var m = dir.match(/^(.+?\/Xcode.*\.app)\//),
							xcodeapp = m ? m[1] : path.join(dir, 'Applications', 'Xcode.app'),
							xcodebuild = path.join(dir, 'usr', 'bin', 'xcodebuild'),
							plistfile = path.join(path.dirname(dir), 'version.plist'),
							p, info, key;
						
						if (afs.exists(xcodebuild) && afs.exists(plistfile)) {
							p = new plist(plistfile);
							info = {
								path: dir,
								xcodeapp: xcodeapp,
								xcodebuild: xcodebuild,
								selected: dir == selected,
								version: p.CFBundleShortVersionString,
								build: p.ProductBuildVersion,
								sdks: null,
								sims: null
							};
							key = info.version + ':' + info.build;
							
							// if we already have this version of Xcode, ignore unless it's currently the selected version
							if (!xcodeInfo[key] || info.selected || dir <= xcodeInfo[key].path) {
								xcodeInfo[key] = info;
								info.selected && (xcodeInfo.__selected__ = info);
								info.sdks = getSDKs(dir, 'Platforms', 'iPhoneOS.platform', 'Developer', 'SDKs');
								info.sims = getSDKs(dir, 'Platforms', 'iPhoneSimulator.platform', 'Developer', 'SDKs');
							}
						}
						cb();
					};
				}), function () {
					callback(null, xcodeInfo);
				});
			});
		},
		
		function (callback) {
			exec('security dump-keychain', {
				maxBuffer: 1024 * 1024
			}, function (err, stdout, stderr) {
				var result = {
					devNames: [],
					distNames: [],
					wwdr: false
				};
				
				if (!err) {
					stdout.split('\n').forEach(function (line) {
						var m = line.match(/"iPhone Developer\: (.*)"/);
						if (m) {
							result.devNames[m[1].trim()] = 1;
						}
						
						m = line.match(/"iPhone Distribution\: (.*)"/);
						if (m) {
							result.distNames[m[1].trim()] = 1;
						}
						
						if (!result.wwdr && line.indexOf('Apple Worldwide Developer Relations Certification Authority') == -1) {
							result.wwdr = true;
						}
					});
					
					result.devNames = Object.keys(result.devNames).sort();
					result.distNames = Object.keys(result.distNames).sort();
				}
				
				callback(null, result);
			});
		},
		
		function (callback) {
			var dir = afs.resolvePath('~/Library/MobileDevice/Provisioning Profiles'),
				provisioningProfiles = {
					adhoc: [],
					development: [],
					distribution: []
				};
			
			afs.exists(dir) && fs.readdirSync(dir).forEach(function (file) {
				if (/.+\.mobileprovision$/.test(file)) {
					var contents = fs.readFileSync(path.join(dir, file)).toString(),
						i = contents.indexOf('<?xml'),
						j = contents.lastIndexOf('</plist>'),
						p,
						dest = 'development',
						appPrefix,
						entitlements;
					
					if (i != -1 && j != -1) {
						p = new plist().parse(contents.substring(i, j + 8));
						appPrefix = (p.ApplicationIdentifierPrefix || []).shift();
						entitlements = p.Entitlements || {};
						
						if (!p.ProvisionedDevices || !p.ProvisionedDevices.length) {
							dest = 'distribution';
						} else if (new Buffer(p.DeveloperCertificates[0], 'base64').toString().indexOf('Distribution:') != -1) {
							dest = 'adhoc';
						}
						
						provisioningProfiles[dest].push({
							uuid: p.UUID,
							name: p.Name,
							appPrefix: appPrefix,
							appId: (entitlements['application-identifier'] || '').replace(appPrefix + '.', ''),
							getTaskAllow: entitlements['get-task-allow'] || '',
							apsEnvironment: entitlements['aps-environment'] || ''
						});
					}
				}
			});
			
			callback(null, provisioningProfiles);
		},
		
		function (callback) {
			var result = [];
			exec('security list-keychains', function (err, stdout, stderr) {
				if (!err) {
					result = result.concat(stdout.split('\n').filter(function (line) {
						var m = line.match(/[^"]*"([^"]*)"/);
						m && result.push(m[1].trim());
					}));
				}
			});
			callback(null, result);
		}

	], function (err, results) {
		finished(cached = {
			xcode: results[0],
			certs: results[1],
			provisioningProfiles: results[2],
			keychains: results[3]
		});
	});
};
