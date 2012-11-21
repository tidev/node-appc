/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var i18n = require('./i18n')(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = require('./fs'),
	sdkPaths = require('./environ').os.sdkPaths,
	version = require('./version'),
	util = require('./util'),
	zip = require('./zip'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	modules,
	zipRegExp = /^.+\-.+?\-.+?\.zip$/,
	invalidPlatformRegExp = /^osx|win32|linux$/;

function detectModules(searchPaths, logger, callback) {
	var results = {};
	Array.isArray(searchPaths) || (searchPaths = [searchPaths]);
	async.parallel(searchPaths.map(function (root) {
		return function(cb) {
			if (!afs.exists(root = afs.resolvePath(root))) return cb();
			
			var moduleRoot = path.join(root, 'modules'),
				tasks = [];
			
			if (!afs.exists(moduleRoot)) return cb();
			
			// auto-install zipped modules
			fs.readdirSync(root).forEach(function (file) {
				var moduleZip = path.join(root, file);
				if (fs.statSync(moduleZip).isFile() && zipRegExp.test(file)) {
					tasks.push(function (taskDone) {
						logger && logger.info(__('Installing module: %s', file));
						zip.unzip(moduleZip, root, function () {
							try {
								fs.unlinkSync(moduleZip);
							} catch (e) {}
							taskDone();
						});
					});
				}
			});
			
			async.parallel(tasks, function () {
				logger && logger.debug(__('Detecting modules in %s', moduleRoot.cyan));
				
				// loop through platforms
				fs.readdirSync(moduleRoot).forEach(function (platform) {
					var modulesPath = path.join(moduleRoot, platform);
					if (fs.lstatSync(modulesPath).isDirectory() && !invalidPlatformRegExp.test(platform)) {
						// loop through module names
						fs.readdirSync(modulesPath).forEach(function (moduleName) {
							var modulePath = path.join(modulesPath, moduleName);
							if (fs.lstatSync(modulePath).isDirectory()) {
								// loop through versions
								fs.readdirSync(modulePath).forEach(function (ver) {
									var versionPath = path.join(modulePath, ver),
										manifestFile = path.join(versionPath, 'manifest');
									if (fs.lstatSync(versionPath).isDirectory() && afs.exists(manifestFile)) {
										var dest = results[platform] || (results[platform] = {}),
											mod = dest[moduleName] || (dest[moduleName] = {});
										
										if (!mod[ver]) {
											mod[ver] = {
												modulePath: versionPath,
												manifest: {}
											};
											
											fs.readFileSync(manifestFile).toString().split('\n').forEach(function (line) {
												var p = line.indexOf(':');
												if (line.charAt(0) != '#' && p != -1) {
													mod[ver].manifest[line.substring(0, p)] = line.substring(p + 1).trim();
												}
											});
											
											logger && logger.debug(__('Detected module: %s %s @ %s', mod[ver].manifest.moduleid.cyan, mod[ver].manifest.version, mod[ver].modulePath));
										}
									}
								});
							}
						});
					}
				});
				
				cb();
			});
		};
	}), function (err) {
		callback(err, results);
	});
}

exports.detect = function (searchPaths, logger, callback) {
	if (modules) {
		return callback(modules);
	}
	
	async.parallel({
		project: function (next) {
			detectModules(searchPaths, logger, next);
		},
		global: function (next) {
			detectModules(sdkPaths, logger, next);
		}
	}, function (err, results) {
		callback(modules = results);
	});
};

exports.find = function (modules, platforms, deployType, sdkVersion, searchPaths, logger, callback) {
	var result = {
			found: [],
			missing: [],
			incompatible: []
		},
		visited = {};
	
	// if there are modules to find, then just exit now
	if (!modules || !modules.length) return callback(result);
	
	Array.isArray(platforms) || (platforms = [platforms]);
	platforms.push('commonjs');
	
	exports.detect(searchPaths, logger, function (installed) {
		modules.forEach(function (module) {
			var originalVersion = module.version || 'latest',
				scopes = ['project', 'global'],
				i, j, scope, info, platform, found;
			
			if (module.deployType && module.deployType != deployType) return;
			module.deployType || (module.deployType = deployType);
			
			if (module.platform && platforms.indexOf(module.platform) == -1) return;
			if (module.platform) {
				Array.isArray(module.platform) || (module.platform = [module.platform]);
			} else {
				module.platform = platforms;
			}
			
			if (!module.version) {
				scopes.forEach(function(scope) {
					// search both project and global modules for the latest version
					var x = installed[scope][module.platform];
					if (!module.version && x && x[module.id]) {
						module.version = Object.keys(x[module.id]).sort().pop();
					}
				});
			}
			
			var key = module.id + '|' + module.deployType + '|' + module.platform.join(',') + '|' + module.version;
			if (visited[key]) return;
			visited[key] = 1;
			
			logger && logger.debug(__('Looking for Titanium module id: %s version: %s platform: %s', module.id.cyan, originalVersion.cyan, module.platform.cyan));
			
			for (i = 0; !found && i < scopes.length; i++) {
				scope = installed[scopes[i]];
				for (j = 0; !found && j < module.platform.length; j++) {
					platform = module.platform[j];
					if (scope[platform] && scope[platform][module.id]) {
						info = scope[platform][module.id][module.version];
						if (info) {
							util.mix(module, info);
							if (sdkVersion && info.minsdk && version.gt(info.minsdk, sdkVersion)) {
								incompatible.push(module);
							} else {
								result.found.push(module);
							}
							found = true;
						}
					}
				}
			}
			
			if (!found) {
				logger && logger.warn(__('Could not find Titanium module id: %s version: %s platform: %s', module.id.cyan, originalVersion.cyan, module.platform.cyan));
				result.missing.push(module);
			}
		});
		
		callback(result);
	});
};