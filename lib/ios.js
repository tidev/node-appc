/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var exec = require('child_process').exec,
	async = require('async'),
	util = require('./util'),
	fs = require('fs'),
	semver = require('semver');

exports.detect = function (finished, opts) {
	if (process.platform != 'darwin') return finished();
	
	opts = opts || {};
	
	async.parallel([
		function (callback) {
			exec('xcode-select -print-path', function (err, stdout, stderr) {
				function test(a) {
					for (var i = 0, l = a.length; i < l; i++) {
						if (fs.lstatSync(a[i]).isDirectory()) {
							callback(null, a[i]);
							return 1;
						}
					}
				}
				
				if (!err) {
					if (test([stdout.toString().trim()])) return;
				}
				
				logger.info('Xcode 4.3+ likely, searching for developer folders');
				
				if (test(['/Developer', '/Applications/Xcode.app/Contents/Developer'])) return;
				
				exec('mdfind kMDItemDisplayName==Xcode&&kMDItemKind==Application', function (err, stdout, stderr) {
					if (!err && test(stdout.toString().trim().split('\n').map(function (s) { return path.join(s, 'Contents', 'Developer'); }))) return;
					
					// just in case we didn't find any matches
					callback();
				});
			});
		},
		
		function (callback) {
			exec('xcodebuild -showsdks', function (err, stdout, stderr) {
				var result = {
					sdks: [],
					simulators: []
				};
				
				if (!err) {
					stdout.split('\n').forEach(function (line) {
						var m = line.match(/(iphoneos|iphonesimulator)(.+)$/);
						if (m) {
							var parts = m[2].split('.'),
								ver = parts.length == 2 ? parts.concat(['0']).join('.') : m[2];
							semver.gte(ver, opts.minSDK || '4.0.0') && result[m[1] == 'iphoneos' ? 'sdks' : 'simulators'].push(ver);
						}
					});
				}
				
				callback(null, result);
			});
		},
		
		function (callback) {
			exec('security dump-keychain', function (err, stdout, stderr) {
				var result = {
					dev: false,
					devNames: {},
					dist: false,
					distNames: {},
					wwdr: false
				};
				
				if (!err) {
					stdout.split('\n').forEach(function (line) {
						var m = line.match(/"iPhone Developer\: (.*)"/);
						if (m) {
							result.dev = true;
							result.devNames[m[1].trim()] = 1;
						}
						
						m = line.match(/"iPhone Distribution\: (.*)"/);
						if (m) {
							result.dist = true;
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
		}
	], function (err, results) {
		finished(util.mix({
			xcodePath: results[0]
		}, results[1], results[2]));
	});
};
