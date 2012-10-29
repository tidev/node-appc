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
	afs = require('./fs'),
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	plugins;

function detectPlugins(searchPaths, logger, callback) {
	var results = {};
	
	Array.isArray(searchPaths) || (searchPaths = [searchPaths]);
	
	searchPaths.forEach(function (pluginRoot) {
		pluginRoot = afs.resolvePath(pluginRoot);
		if (!afs.exists(pluginRoot)) return;
		
		logger && logger.debug(__('Detecting plugins in %s', pluginRoot.cyan));
		
		var packageFile = path.join(pluginRoot, 'package.json'),
			packageFileExists = afs.exists(packageFile) && (afs.exists(path.join(pluginRoot, 'commands')) || afs.exists(path.join(pluginRoot, 'hooks'))),
			pluginFile = path.join(pluginRoot, 'plugin.py'),
			pluginFileExists = afs.exists(pluginFile),
			pluginName = path.basename(pluginRoot);
		
		if (packageFileExists || pluginFileExists) {
			// we have a plugin without a version folder
			var plugin = results[pluginName] || (results[pluginName] = {});
			plugin['-'] = {
				pluginPath: pluginRoot
			};
			
			if (packageFileExists) {
				try {
					plugin['-'].manifest = JSON.parse(fs.readFileSync(packageFile));
				} catch (e) {}
			}
			
			if (pluginFileExists) {
				plugin['-'].legacyPluginFile = pluginFile;
			}
			
			logger && logger.debug(__('Detected plugin: %s @ %s', pluginName.cyan, pluginRoot.cyan));
		} else {
			// loop through plugin names
			fs.readdirSync(pluginRoot).forEach(function (pluginName) {
				var pluginsPath = path.join(pluginRoot, pluginName);
				if (fs.lstatSync(pluginsPath).isDirectory() && !/\.git|\.svn|CVS/.test(pluginName)) {
					var packageFile = path.join(pluginsPath, 'package.json'),
						packageFileExists = afs.exists(packageFile),
						pluginFile = path.join(pluginsPath, 'plugin.py'),
						pluginFileExists = afs.exists(pluginFile),
						pluginName = path.basename(pluginsPath);
					
					if (pluginFileExists || afs.exists(path.join(pluginsPath, 'commands')) || afs.exists(path.join(pluginsPath, 'hooks'))) {
						// we have a plugin without a version folder
						var plugin = results[pluginName] || (results[pluginName] = {});
						plugin['-'] = {
							pluginPath: pluginsPath
						};
						
						if (packageFileExists) {
							try {
								plugin['-'].manifest = JSON.parse(fs.readFileSync(packageFile));
							} catch (e) {}
						}
						
						if (pluginFileExists) {
							plugin['-'].legacyPluginFile = pluginFile;
						}
						
						logger && logger.debug(__('Detected plugin: %s @ %s', pluginName.cyan, pluginsPath.cyan));
					} else {
						// loop through versions
						fs.readdirSync(pluginsPath).forEach(function (ver) {
							var versionPath = path.join(pluginsPath, ver),
								packageFile = path.join(versionPath, 'package.json'),
								packageFileExists = afs.exists(packageFile),
								pluginFile = path.join(versionPath, 'plugin.py'),
								pluginFileExists = afs.exists(pluginFile),
								plugin;
							
							if (pluginFileExists || afs.exists(path.join(versionPath, 'commands')) || afs.exists(path.join(versionPath, 'hooks'))) {
								plugin = results[pluginName] || (results[pluginName] = {});
								plugin[ver] = {
									pluginPath: versionPath
								};
								
								if (packageFileExists) {
									try {
										plugin[ver].manifest = JSON.parse(fs.readFileSync(packageFile));
									} catch (e) {}
								}
								
								if (pluginFileExists) {
									plugin[ver].legacyPluginFile = pluginFile;
								}
								
								logger && logger.debug(__('Detected plugin: %s %s @ %s', pluginName.cyan, ver, versionPath.cyan));
							}
						});
					}
				}
			});
		}
	});
	
	callback(null, results);
}

exports.detect = function (projectDir, config, logger, callback) {
	if (plugins) {
		return callback(plugins);
	}
	async.parallel({
		project: function (next) {
			detectPlugins(path.join(projectDir, 'plugins'), logger, next);
		},
		user: function (next) {
			if (config.paths && Array.isArray(config.paths.plugins)) {
				detectPlugins(config.paths.plugins, logger, next);
			} else {
				next();
			}
		},
		global: function (next) {
			detectPlugins(sdkPaths.map(function (p) {
				return path.join(p, 'plugins');
			}), logger, next);
		}
	}, function (err, results) {
		callback(plugins = results);
	});
};

exports.find = function (plugins, projectDir, config, logger, callback) {
	var result = {
			found: [],
			missing: []
		},
		visited = {};
	
	// if there are plugins to find, then just exit now
	if (!plugins || !plugins.length) return callback(result);
	
	exports.detect(projectDir, config, logger, function (installed) {
		plugins.forEach(function (plugin) {
			var originalVersion = plugin.version || 'latest',
				scopes = ['project', 'user', 'global'], // the order here represents precendence
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
				if (scope[plugin.id]) {
					info = scope[plugin.id][plugin.version] || scope[plugin.id]['-'];
					if (info) {
						util.mix(plugin, info);
						result.found.push(plugin);
						found = true;
					}
				}
			}
			
			if (!found) {
				logger && logger.warn(__('Could not find Titanium plugin id: %s version: %s', plugin.id.cyan, originalVersion.cyan));
				result.missing.push(plugin);
			}
		});
		
		callback(result);
	});
};