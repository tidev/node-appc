/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var path = require('path'),
	fs = require('fs'),

	async = require('async'),

	afs = require('./fs'),
	mix = require('./util').mix,
	sdkPaths = require('./environ').os.sdkPaths,
	
	globalModulesManifestPath = afs.resolvePath(path.join('~', '.titanium', 'modules.json')),
	globalModules,
	moduleZipRegExp = /^.+\-.+?\-.+?\.zip$/;

exports.getGlobalModules = function(callback) {
	if (!globalModules) {
		globalModules = {};
		async.parallel(sdkPaths.map(function (p) {
			return function(cb) {
				detectModules(p, globalModules, cb);
			};
		}), function() {
			var globalModulesManifest = loadModulesManifest(globalModulesManifestPath);
			for(var mod in globalModules) {
				for(var version in globalModules[mod]) {
					globalModules[mod][version].activated = !!globalModulesManifest[mod] &&
						globalModulesManifest[mod]['activated-version'] === version;
				}
			}
			callback && callback(globalModules);
		});
	} else {
		callback && callback(globalModules);
	}
};

exports.getProjectModules = function(projectDir, callback) {
	var modules = {};
	if (afs.exists(afs.resolvePath(projectDir))) {
		detectModules(projectDir, modules, function() {
			var projectModulesManifest = loadModulesManifest(path.join(projectDir, '.modules.json'));
			for(var mod in modules) {
				for(var version in modules[mod]) {
					modules[mod][version].activated = !!projectModulesManifest[mod] &&
						projectModulesManifest[mod]['activated-version'] === version;
					
				}
			}
			callback && callback(modules);
		});
	} else {
		callback && callback(modules);
	}
};

function detectModules(searchPath, modules, callback) {

	function searchModuleDir(moduleName, modulePath, platform, isGlobal) {
		afs.visitDirsSync(modulePath, function (version, versionPath) {
			var manifestFile = path.join(versionPath, 'manifest');
			if (afs.exists(manifestFile)) {
				var module = modules[moduleName] || (modules[moduleName] = {}),
					details = module[version] || (module[version] = {
						modulePath: versionPath,
						manifest: {},
						platforms: {},
						global: isGlobal
					});

				fs.readFileSync(manifestFile).toString().split('\n').forEach(function (line) {
					var p = line.indexOf(':'),
						key,
						value;
					if (line.charAt(0) != '#' && p != -1) {
						key = line.substring(0, p);
						value = details.manifest[key] = line.substring(p + 1).trim();
						if (platform) {
							// old style
							details.platforms[platform] || (details.platforms[platform] = { originalManifest: {} });
							details.platforms[platform].originalManifest[key] = value;
						} else {
							// new style
							key == 'platforms' && value.split(',').forEach(function (p) {
								details.platforms[p.trim()] = {}; // empty for now...
							});
						}
					}
				});
			}
		});
	}

	searchPath = afs.resolvePath(searchPath);
	afs.exists(searchPath, function (exists) {
		if (!exists) return callback();

		var moduleRoot = path.join(searchPath, 'modules'),
			tasks = [];

		// auto-install zipped modules
		fs.readdirSync(searchPath).forEach(function (file) {
			var moduleZip = path.join(searchPath, file);
			if (fs.lstatSync(moduleZip).isFile() && moduleZipRegExp.test(file)) {
				tasks.push(function (taskDone) {
					zip.unzip(moduleZip, searchPath, function () {
						try {
							fs.unlinkSync(moduleZip);
						} catch (e) {}
						taskDone();
					});
				});
			}
		});

		async.parallel(tasks, function () {
			// search module directories
			afs.visitDirs(moduleRoot, function (platform, modulesPath) {
				if (/^osx|win32|linux$/.test(platform)) {
					// skip old Titanium Desktop directories
				} else if (/^android|iphone|mobileweb|commonjs$/.test(platform)) {
					// old style module directory
					afs.visitDirsSync(modulesPath, function (moduleName, modulePath) {
						searchModuleDir(moduleName, modulePath, platform);
					});
				} else {
					// possibly a new style module directory
					searchModuleDir(platform, modulesPath);
				}
			}, callback);
		});
	});
}

exports.getModules = function(projectDir, callback) {
	async.parallel([
		function(next) {
			exports.getGlobalModules(function(modules) {
				next(null, modules);
			});
		},
		function(next) {
			exports.getProjectModules(projectDir, function(modules) {
				next(null, modules);
			});
		}
	], function(err, results) {
		callback && callback(mix(results[0], results[1]));
	});
};

exports.getActivatedModules = function(projectDir, callback) {
	exports.getModules(projectDir, function(modules) {
		for(var mod in modules) {
			for(var version in modules[mod]) {
				if (!modules[mod][version].activated) {
					delete modules[mod][version];
				}
			}
			if (!Object.keys(modules[mod]).length) {
				delete modules[mod];
			}
		}
		callback && callback(modules);
	});
};

exports.activateGlobalModule = function(name, version) {
	var globalModulesManifest = loadModulesManifest(globalModulesManifestPath);
	globalModulesManifest[name] || (globalModulesManifest[name] = {});
	globalModulesManifest[name] = {
		'activated-version': version
	};
	saveModulesManifest(globalModulesManifestPath, globalModulesManifest);
};

exports.deactivateGlobalModule = function(name) {
	var globalModulesManifest = loadModulesManifest(globalModulesManifestPath);
	delete globalModulesManifest[name];
	saveModulesManifest(globalModulesManifestPath, globalModulesManifest);
};

exports.activateProjectModule = function(projectDir, name, version) {
	var projectModulesManifestPath = path.join(projectDir, '.modules.json'),
		projectModulesManifest = loadModulesManifest(projectModulesManifestPath);
	projectModulesManifest[name] || (projectModulesManifest[name] = {});
	projectModulesManifest[name] = {
		'activated-version': version
	};
	saveModulesManifest(projectModulesManifestPath, projectModulesManifest);
};

exports.deactivateProjectModule = function(projectDir, name) {
	var projectModulesManifestPath = path.join(projectDir, '.modules.json'),
		projectModulesManifest = loadModulesManifest(projectModulesManifestPath);
	delete projectModulesManifest[name];
	saveModulesManifest(projectModulesManifestPath, projectModulesManifest);
};

function loadModulesManifest(path) {
	path = afs.resolvePath(path);
	if (afs.exists(path)) {
		try {
			return JSON.parse(fs.readFileSync(path));
		} catch (e) {
			return {};
		}
	} else {
		return {};
	}
}

function saveModulesManifest(path, content) {
	fs.writeFileSync(afs.resolvePath(path), JSON.stringify(content, null, '\t'));
}