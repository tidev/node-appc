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
	util = require('./util'),
	appc = require('node-appc'),
	afs = appc.fs,
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	plugins;

function detectPlugins(searchPaths, logger, callback) {
	var results = {};
	Array.isArray(searchPaths) || (searchPaths = [searchPaths]);
	searchPaths.forEach(function (root) {
		if (!afs.exists(root = afs.resolvePath(root))) return;
		
		var pluginRoot = path.join(root, 'plugins');
		if (!afs.exists(pluginRoot)) return;
		
		logger && logger.debug(__('Detecting plugins in %s', pluginRoot.cyan));
		
		// loop through plugin names
		fs.readdirSync(pluginRoot).forEach(function (pluginName) {
			var pluginsPath = path.join(pluginRoot, pluginName);
			if (fs.lstatSync(pluginsPath).isDirectory()) {
				// loop through versions
				fs.readdirSync(pluginsPath).forEach(function (ver) {
					var versionPath = path.join(pluginsPath, ver),
						packageFile = path.join(versionPath, 'package.json'),
						pluginFile = path.join(versionPath, 'plugin.py'),
						plugin,
						exists;
					
					if (afs.exists(packageFile)) {
						// modern module
						plugin = results[pluginName] || (results[pluginName] = {});
						plugin[ver] = {
							legacy: false,
							pluginPath: versionPath,
							manifest: {}
						};
						try {
							plugin[ver].manifest = JSON.parse(fs.readFileSync(packageFile));
						} catch (e) {}
						logger && logger.debug(__('Detected plugin: %s %s @ %s', pluginName.cyan, ver, pluginFile));
					} else {
						// legacy module
						exists = afs.exists(pluginFile);
						if (!exists) {
							// maybe we have a legacy plugin without the version directory?
							pluginFile = path.join(pluginsPath, 'plugin.py');
							ver = '0.0';
							versionPath = pluginsPath;
							exists = afs.exists(pluginFile);
						}
						if (exists) {
							plugin = results[pluginName] || (results[pluginName] = {});
							plugin[ver] = {
								legacy: true,
								pluginPath: versionPath,
								pluginFile: pluginFile
							};
							logger && logger.debug(__('Detected legacy plugin: %s %s @ %s', pluginName.cyan, ver, pluginFile));
						}
					}
				});
			}
		});
	});
	callback(null, results);
}

exports.detect = function (projectDir, logger, callback) {
	if (plugins) {
		return callback(plugins);
	}
	async.parallel({
		project: function (next) {
			detectPlugins(projectDir, logger, next);
		},
		global: function (next) {
			detectPlugins(sdkPaths, logger, next);
		}
	}, function (err, results) {
		callback(plugins = results);
	});
};

exports.find = function (plugins, projectDir, logger, callback) {
	var result = {
			found: [],
			missing: []
		},
		visited = {};
	
	// if there are plugins to find, then just exit now
	if (!plugins || !plugins.length) return callback(result);
	
	exports.detect(projectDir, logger, function (installed) {
		plugins.forEach(function (plugin) {
			var originalVersion = plugin.version || 'latest',
				scopes = ['project', 'global'],
				i, j, scope, info, platform, found;
			
			if (!plugin.version) {
				scopes.forEach(function(scope) {
					// search both project and global plugins for the latest version
					var x = installed[scope];
					if (!plugin.version && x && x[plugin.id]) {
						plugin.version = Object.keys(x[plugin.id]).sort().pop();
					}
				});
			}
			
			var key = plugin.id + '|' + plugin.version;
			if (visited[key]) return;
			visited[key] = 1;
			
			logger && logger.debug(__('Looking for Titanium plugin id: %s version: %s', plugin.id.cyan, originalVersion.cyan));
			
			for (i = 0; !found && i < scopes.length; i++) {
				scope = installed[scopes[i]];
				if (scope[plugin.id] && scope[plugin.id][plugin.version]) {
					info = scope[plugin.id][plugin.version];
					if (info) {
						util.mix(plugin, info);
						result.found.push(plugin);
						found = true;
					}
				}
			}
			
			if (!found) {
				logger && logger.warn(__('Could not find Titanium plugin id: %s version: %s', module.id.cyan, originalVersion.cyan));
				result.missing.push(module);
			}
		});
		
		callback(result);
	});
};