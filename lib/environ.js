/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var fs = require('fs'),
	path = require('path'),
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
	
	readme = /readme.*/i,
	jsfile = /\.js$/,
	ignore = /\.?_.*| |\.DS_Store/,
	
	env = module.exports = {
		commands: {},				// map of commands to path of file to require
		os: os && os.name,
		project: {
			commands: {}			// project-based commands
		},
		sdks: {}      				// list of all sdks found
	};

if (!os) {
	throw new Error('Unsupported operating system "' + process.platform + '"');
}

function scanCommands(dest, commandsPath) {
	if (afs.exists(commandsPath)) {
		fs.readdirSync(commandsPath).filter(function (f) {
			f = path.join(commandsPath, f);
			// we don't allow commands that start with _ or have spaces
			return fs.statSync(f).isFile() && jsfile.test(f) && !ignore.test(path.basename(f));
		}).forEach(function (f) {
			var name = f.replace(jsfile, '').toLowerCase();
			dest[name] || (dest[name] = path.join(commandsPath, f));
		});
	}
}

module.exports.scanCommands = scanCommands;

// find all SDKs installed as well as any commands for each platform
os.sdkPaths.forEach(function (titaniumPath) {
	titaniumPath = afs.resolvePath(titaniumPath);
	
	!env.installPath && afs.exists(path.dirname(titaniumPath)) && (env.installPath = titaniumPath);
	
	if (afs.exists(titaniumPath)) {
		
		var mobilesdkPath = path.join(titaniumPath, 'mobilesdk', os.name);
		if (afs.exists(mobilesdkPath)) {
			fs.readdirSync(mobilesdkPath).filter(function (f) {
				var dir = path.join(mobilesdkPath, f);
				return fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some(function (f) {
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
				
				scanCommands(sdk.commands, path.join(sdkPath, 'cli', 'commands'));
				
				platforms.forEach(function (p) {
					sdk.platforms[p] = {
						path: sdkPath,
						commands: {}
					};
					scanCommands(sdk.platforms[p].commands, path.join(sdkPath, p, 'cli', 'commands'));
				});
			});
		}
		
		var modulesPath = path.join(titaniumPath, 'modules');
		if (afs.exists(modulesPath)) {
			scanCommands(env.commands, path.join(modulesPath, 'cli', 'commands'));
		}
	}
});
