/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var i18n = require('./i18n')(__dirname),
	__ = i18n.__,
	__n = i18n.__n,
	afs = require('./fs'),
	version = require('./version'),
	util = require('./util'),
	zip = require('./zip'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	modules,
	zipRegExp = /^.+\-.+?\-.+?\.zip$/,
	invalidPlatformRegExp = /^osx|win32|linux$/,
	platformAliases = {
		// add additional aliases here for new platforms
		'ipad': 'iphone',
		'ios': 'iphone'
	};

function detectModules(searchPaths, logger, callback) {
	var results = {};
	Array.isArray(searchPaths) || (searchPaths = [searchPaths]);
	async.parallel(searchPaths.map(function (root) {
		return function(cb) {
			if (!afs.exists(root)) return cb();
			
			var moduleRoot = path.join(root, 'modules'),
				tasks = [];
			
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
				if (!afs.exists(moduleRoot)) return cb();
				
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
											
											logger && logger.debug(__('Detected %s module: %s %s @ %s', platform, mod[ver].manifest.moduleid.cyan, mod[ver].manifest.version, mod[ver].modulePath));
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
	
	var sdkPaths = [].concat(require('./environ').os.sdkPaths),
		i = sdkPaths.length - 1;
	
	// resolve all sdk paths
	while (i--) {
		sdkPaths[i] = afs.resolvePath(sdkPaths[i]);
	}
	
	// resolve all search paths, but also remove a search path if it's already in the sdk paths
	for (i = 0; i < searchPaths.length; i++) {
		searchPaths[i] = afs.resolvePath(searchPaths[i]);
		if (sdkPaths.indexOf(searchPaths[i]) != -1) {
			searchPaths.splice(i--, 1);
		}
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
			incompatible: [],
			conflict: []
		},
		visited = {},
		modulesById = {};
	
	// if there are modules to find, then just exit now
	if (!modules || !modules.length) return callback(result);
	
	Array.isArray(platforms) || (platforms = [platforms]);
	platforms.push('commonjs'); // add commonjs to the list of valid module platforms
	
	exports.detect(searchPaths, logger, function (installed) {
		modules.forEach(function (module) {
			var originalVersion = module.version || 'latest',
				scopes = ['project', 'global'],
				i, j, scope, info, platform, found, ver;
			
			// make sure the module has a valid array of platforms
			module.platform || (module.platform = platforms);
			Array.isArray(module.platform) || (module.platform = module.platform.split(','));
			
			module.deployType || (module.deployType = deployType);
			Array.isArray(module.deployType) || (module.deployType = module.deployType.split(','));
			
			if (module.deployType.indexOf(deployType) != -1) {
				// if this module doesn't support any of the platforms we're building for, skip it
				if (!module.platform.some(function (a) { return platforms.indexOf(a) != -1; })) {
					return;
				}
				
				// strip all platforms that aren't supported by this build
				for (i = 0; i < module.platform.length; i++) {
					if (platforms.indexOf(module.platform[i]) == -1) {
						module.platform.splice(i--, 1);
					} else if (platformAliases[module.platform[i]] && module.platform.indexOf(platformAliases[module.platform[i]]) == -1) {
						module.platform.push(platformAliases[module.platform[i]]);
					}
				}
				
				var key = module.id + '|' + module.deployType.join(',') + '|' + module.platform.join(',') + '|' + module.version;
				if (visited[key]) return;
				visited[key] = 1;
				
				logger && logger.debug(__('Looking for Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));
				
				for (i = 0; !found && i < scopes.length; i++) {
					scope = installed[scopes[i]];
					for (j = 0; !found && j < module.platform.length; j++) {
						platform = module.platform[j];
						if (scope[platform] && scope[platform][module.id]) {
							ver = module.version || Object.keys(scope[platform][module.id]).sort().pop();
							info = scope[platform][module.id][ver];
							if (info) {
								util.mix(module, info);
								if (sdkVersion && info.minsdk && version.gt(info.minsdk, sdkVersion)) {
									logger && logger.debug(__('Found incompatible Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));
									result.incompatible.push(module);
								} else {
									module.platform = [ platform ];
									logger && logger.info(__('Found Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));
									result.found.push(module);
								}
								found = true;
							}
						}
					}
				}
				
				if (!found) {
					logger && logger.warn(__('Could not find Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));
					result.missing.push(module);
				}
			}
			
			// we found the module, check that the name doesn't conflict with two seperate platform modules
			if (modulesById[module.id]) {
				modulesById[module.id].push(module);
			} else {
				modulesById[module.id] = [module];
			}
		});
		
		Object.keys(modulesById).forEach(function (id) {
			var mods = modulesById[id],
				i = 0,
				len = mods.length,
				commonJs = 0,
				nonCommonJs = 0,
				platforms;
			
			if (len > 1) {
				// we have a potential conflict...
				// verify that we have at least one commonjs platform and at least one non-commonjs platform
				for (; i < len; i++) {
					platforms = Array.isArray(mods[i].platform) ? mods[i].platform : [mods[i].platform];
					platforms.forEach(function (p) {
						if (p.toLowerCase() == 'commonjs') {
							commonJs++;
						} else {
							nonCommonJs++;
						}
					});
				}
				if (commonJs && nonCommonJs) {
					result.conflict.push({
						id: id,
						modules: mods
					});
				}
			}
		});
		
		callback(result);
	});
};