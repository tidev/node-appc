/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	exec = require('child_process').exec,
	afs = require('./fs'),
	
	OSs = {
		darwin: {
			name: 'osx',
			sdkPaths: [
				'~/Library/Application Support/Titanium', // Lion
				'/Library/Application Support/Titanium' // pre-Lion
			]
		},
		win32: {
			name: 'win32',
			sdkPaths: [
				'%ProgramData%\\Titanium', // Windows Vista, Windows 7
				'%APPDATA%\\Titanium', // Windows XP, Windows Server 2003
				'%ALLUSERSPROFILE%\\Application Data\\Titanium' // Windows XP, Windows Server 2003
			]
		},
		linux: {
			name: 'linux',
			sdkPaths: [
				'~/.titanium'
			]
		}
	},
	os = OSs[process.platform],
	osInfo,
	
	readme = /readme.*/i,
	jsfile = /\.js$/,
	ignore = /\.?_.*| |\.DS_Store/,
	
	env = module.exports = {
		commands: {},				// map of commands to path of file to require
		os: os,
		project: {
			commands: {}			// project-based commands
		},
		sdks: {}      				// list of all sdks found
	},
	
	// object to track paths that we've already scanned
	scannedSdkPaths = {};
	scannedCommandPaths = {};

if (!os) {
	throw new Error('Unsupported operating system "' + process.platform + '"');
}

module.exports.scanCommands = function (dest, commandsPath) {
	if (!scannedCommandPaths[commandsPath] && afs.exists(commandsPath)) {
		fs.readdirSync(commandsPath).filter(function (f) {
			f = path.join(commandsPath, f);
			// we don't allow commands that start with _ or have spaces
			return fs.statSync(f).isFile() && jsfile.test(f) && !ignore.test(path.basename(f));
		}).forEach(function (f) {
			var name = f.replace(jsfile, '').toLowerCase();
			dest[name] || (dest[name] = path.join(commandsPath, f));
		});
	}
	scannedCommandPaths[commandsPath] = 1;
};

module.exports.getSDK = function (version) {
	if (!version || version == 'latest') {
		version = Object.keys(env.sdks).sort().pop();
	}
	return env.sdks[version] || null;
};

module.exports.detect = function (paths) {
	var sdkPaths = [].concat(os.sdkPaths);
	Array.isArray(paths) && (sdkPaths = sdkPaths.concat(paths));
	sdkPaths.forEach(function (titaniumPath) {
		titaniumPath = afs.resolvePath(titaniumPath);
		
		if (scannedSdkPaths[titaniumPath]) return;
		scannedSdkPaths[titaniumPath] = 1;
		
		!env.installPath && afs.exists(path.dirname(titaniumPath)) && (env.installPath = titaniumPath);
		
		if (afs.exists(titaniumPath)) {
			var mobilesdkPath = path.join(titaniumPath, 'mobilesdk', os.name);
			if (afs.exists(mobilesdkPath)) {
				fs.readdirSync(mobilesdkPath).filter(function (f) {
					var dir = path.join(mobilesdkPath, f);
					return afs.exists(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some(function (f) {
						return readme.test(f);
					});
				}).filter(function (f) {
					for (var i = 0; i < env.sdks.length; i++) {
						if (env.sdks[i].version == f) {
							return false;
						}
					}
					return true;
				}).sort(function (a, b) {
					if (a === b) return 0;
					if (a < b) return 1;
					return -1;
				}).map(function (v) {
					var sdkPath = path.join(mobilesdkPath, v),
						manifestFile = path.join(sdkPath, 'manifest.json'),
						manifest,
						platforms = ['android', 'iphone', 'mobileweb'],
						sdk = env.sdks[v] = {
							commands: {},
							name: v,
							path: sdkPath,
							platforms: {}
						};
					
					if (afs.exists(manifestFile)) {
						// read in the manifest
						try {
							manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
							manifest && (sdk.manifest = manifest);
						} catch (e) {}
					}
					
					platforms = manifest ? manifest.platforms : platforms;
					platforms.forEach(function (p) {
						var pp = path.join(sdkPath, p);
						if (afs.exists(pp)) {
							sdk.platforms[p] = {
								path: pp,
								commands: {}
							};
						}
					});
				});
			}
		}
	});
};

module.exports.getOSInfo = function (callback) {
	if (osInfo) {
		callback(osInfo);
		return;
	}
	
	var _os = require('os');
	
	// do NOT change the names of these keys... they are specifically used by analytics
	osInfo = {
		os: '',
		platform: process.platform.replace(/darwin/, 'osx'),
		osver: '',
		ostype: (/64/.test(process.arch) ? 64 : 32) + 'bit',
		oscpu: _os.cpus().length,
		memory: _os.totalmem(),
		node: process.version,
		npm: ''
	};
	
	async.series([
		function (next) {
			switch (process.platform) {
				case 'darwin':
					exec('sw_vers', function (err, stdout, stderr) {
						if (!err) {
							var m = stdout.match(/ProductName:\s+(.+)/i),
								m2 = stdout.match(/ProductVersion:\s+(.+)/i);
							m && (osInfo.os = m[1]);
							m2 && (osInfo.osver = m2[1]);
						}
						next();
					});
					break;
				
				case 'linux':
					if (afs.exists('/etc/lsb-release')) {
						var s = fs.readFileSync('/etc/lsb-release').toString(),
							m = s.match(/DISTRIB_DESCRIPTION=(.+)/i),
							m2 = s.match(/DISTRIB_RELEASE=(.+)/i);
						m && (osInfo.os = m[1].replace(/"/g, ''));
						m2 && (osInfo.osver = m2[1].replace(/"/g, ''));
					}
					osInfo.os || (osInfo.os = 'GNU/Linux');
					next();
					break;
				
				case 'win32':
					exec('wmic os get Caption,Version', function (err, stdout, stderr) {
						if (!err) {
							var s = stdout.split('\n')[1].split(/ {2,}/);
							s.length > 0 && (osInfo.os = s[0].trim());
							s.length > 1 && (osInfo.osver = s[1].trim());
						}
						next();
					}).stdin.end();
					break;
				
				default:
					// this should never happen
					next();
			}
		}
	], function () {
		exec('npm --version', function (err, stdout, stderr) {
			if (!err) {
				osInfo.npm = stdout.trim();
			}
			callback(osInfo);
		});
	});
};
