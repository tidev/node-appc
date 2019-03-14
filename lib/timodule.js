/**
 * Detects installed Titanium modules.
 *
 * @module timodule
 *
 * @copyright
 * Copyright (c) 2009-2019 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

const __ = require('./i18n')(__dirname).__;
const afs = require('./fs');
const fs = require('fs-extra');
const path = require('path');
const util = require('./util');
const version = require('./version');
const zip = require('./zip');

const platformAliases = {
	// add additional aliases here for new platforms
	ipad: 'ios',
	iphone: 'ios'
};

let moduleCache = {};

exports.scopedDetect = scopedDetect;
exports.detect = detect;
exports.find = find;
exports.detectNodeModules = detectNodeModules;

/**
 * Scans search paths for Titanium modules. This function will not scan any paths
 * other than the ones explicitly told to scan.
 *
 * @param {Object} searchPaths - An object of scopes to arrays of paths to search for Titanium modules.
 * @param {Object} config - The CLI config.
 * @param {Object} logger - A logger instance.
 * @param {Function} callback - A function to call when done.
 * @param {Boolean} [bypassCache=false] - When true, re-scans the specified paths for modules.
 * @returns {void}
 */
function scopedDetect(searchPaths, config, logger, callback, bypassCache) {
	if (!searchPaths || typeof searchPaths !== 'object') {
		callback();
		return;
	}

	const tasks = [];
	const results = {};

	Object.keys(searchPaths).forEach(function (scope) {
		(Array.isArray(searchPaths[scope]) ? searchPaths[scope] : [ searchPaths[scope] ]).forEach(function (searchPath) {
			if (!searchPath) {
				return;
			}
			tasks.push(
				detectModules(searchPath, {
					bypassCache,
					logger
				}).then(modules => {
					results[scope] = modules;
				})
			);
		});
	});

	Promise.all(tasks)
		.then(() => callback(results))
		.catch(err => {
			console.error(err);
			callback();
		});
}

/**
 * Scans search paths for Titanium modules. This function will scan all known
 * Titanium SDK locations.
 *
 * @param {Object|string[]} paramsOrSearchPaths - An object with the following params; or an array of paths to search for Titanium modules.
 * @param {Array<String>} [paramsOrSearchPaths.searchPaths] - An array of paths to search for Titanium modules.
 * @param {Object} [paramsOrSearchPaths.logger] - A logger instance.
 * @param {Function} [paramsOrSearchPaths.callback] - A function to call when done.
 * @param {Boolean} [paramsOrSearchPaths.bypassCache=false] - When true, re-scans the specified paths for modules.
 * @param {Object} [logger] - A logger instance.
 * @param {Function} [callback] - A function to call when done.
 * @param {Boolean} [bypassCache=false] - When true, re-scans the specified paths for modules.
 */
function detect(paramsOrSearchPaths, logger, callback, bypassCache) {
	let params;
	if (arguments.length === 1 && typeof paramsOrSearchPaths === 'object' && paramsOrSearchPaths !== null) {
		params = paramsOrSearchPaths;
	} else {
		params = {
			bypassCache,
			callback,
			logger,
			searchPaths: paramsOrSearchPaths
		};
	}

	// resolve all sdk paths
	const sdkPaths = new Set(require('./environ').os.sdkPaths.map(p => afs.resolvePath(p)));
	const globalTasks = [];
	for (const searchPath of sdkPaths) {
		globalTasks.push(detectModules(path.join(searchPath, 'modules'), params));
	}
	// TODO: Add tasks to search for node_modules via global node_modules/paths, use require.resolve.paths?
	// We need to run "node npm root -g" to get the path to global install dir
	const globalsPromise = Promise.all(globalTasks);

	const additionalSearchPaths = (Array.isArray(params.searchPaths) ? params.searchPaths : [ params.searchPaths ])
		.filter(p => p) // remove nulls
		.map(p => afs.resolvePath(p)) // resolve the paths
		.filter(p => !sdkPaths.has(p)); // remove duplicates from sdkPaths
	// TODO: Put additionalSearchPaths into a Set to remove duplicates in itself!
	const projectPath = additionalSearchPaths[0]; // first path should be the project dir!
	// TODO: Add task to search for node_modules from projectPath!

	const projectTasks = [];
	projectTasks.push(detectNodeModules([ path.join(projectPath, 'node_modules') ]).then(modules => convertArrayOfModulesToHierarchy(modules)));
	for (const searchPath of new Set(additionalSearchPaths)) {
		projectTasks.push(detectModules(path.join(searchPath, 'modules'), params));
	}
	const projectPromise = Promise.all(projectTasks);

	Promise.all([ globalsPromise, projectPromise ])
		.then(results => {
			// results[0] is globals
			const global = {};
			results[0].forEach(r => mix(r, global));
			// results[1] is project
			const project = {};
			results[1].forEach(r => mix(r, project));
			const combined = {
				global,
				project
			};
			typeof params.callback === 'function' && params.callback(combined);
		})
		.catch(err => {
			console.error(err);
			// typeof params.callback === 'function' && params.callback();
		});

	// non-destructively, but deeply mix two objects
	function mix(src, dest) {
		if (!src || !dest) {
			return;
		}

		Object.keys(src).forEach(function (key) {
			if (!dest[key] || typeof dest[key] !== 'object') {
				dest[key] = {};
			}

			if (src[key] !== null && typeof src[key] === 'object' && !Array.isArray(src[key])) {
				mix(src[key], dest[key]);
			} else {
				dest[key] = src[key];
			}
		});
	}
}

/**
 * Detects all installed Titanium modules, then it will validate that the
 * specified modules are found, incompatible, missing, or conflicting.
 *
 * @param {Array<Object>|Object} modulesOrParams - An object with the following params; or An array of modules to search for
 * @param {Array<Object>|Object} [modulesOrParams.modules] - An array of modules to search for.
 * @param {Array<String>|String} [modulesOrParams.platforms] - An array of platform names (if the platform has more than one name) or a string of comma-separated platform names.
 * @param {Array<String>|String} [modulesOrParams.deployType] - An array of deploy types or a string of comma-separated deploy types to filter by.
 * @param {Object} [modulesOrParams.tiManifest] - The Titanium SDK manifest data.
 * @param {Array<String>} [modulesOrParams.searchPaths] - An array of paths to search for Titanium modules.
 * @param {Object} [modulesOrParams.logger] - A logger instance.
 * @param {Function} [modulesOrParams.callback] - A function to call when done.
 * @param {Boolean} [modulesOrParams.bypassCache=false] - When true, re-detects all modules.
 * @param {Array<String>|String} [platforms] - An array of platform names (if the platform has more than one name) or a string of comma-separated platform names.
 * @param {Array<String>|String} [deployType] - An array of deploy types or a string of comma-separated deploy types to filter by.
 * @param {Object} [tiManifest] - The Titanium SDK manifest data.
 * @param {Array<String>} [searchPaths] - An array of paths to search for Titanium modules.
 * @param {Object} [logger] - A logger instance.
 * @param {Function} [callback] - A function to call when done.
 * @param {Boolean} [bypassCache=false] - When true, re-detects all modules.
 */
function find(modulesOrParams, platforms, deployType, tiManifest, searchPaths, logger, callback, bypassCache) {
	const result = {
			found: [],
			missing: [],
			incompatible: [],
			conflict: []
		},
		visited = {},
		modulesById = {};

	let sdkVersion,
		moduleAPIVersion;
	if (tiManifest && typeof tiManifest === 'object') {
		sdkVersion = tiManifest.version;
		moduleAPIVersion = tiManifest.moduleAPIVersion;
	} else {
		sdkVersion = tiManifest;
	}

	let params;
	if (arguments.length === 1 && typeof modulesOrParams === 'object' && modulesOrParams !== null) {
		params = modulesOrParams;
	} else {
		params = {
			bypassCache: bypassCache,
			callback: callback,
			deployType: deployType,
			logger: logger,
			modules: modulesOrParams,
			platforms: platforms,
			sdkVersion: sdkVersion,
			searchPaths: searchPaths
		};
	}

	if (!params.modules || params.modules.length === 0) {
		typeof params.callback === 'function' && params.callback(result);
		return;
	}

	// clean up platforms
	if (typeof params.platforms === 'string') {
		params.platforms = params.platforms.split(',').filter(p => p);
	} else if (Array.isArray(params.platforms)) {
		params.platforms = params.platforms.filter(p => p);
	} else {
		params.platforms = [];
	}
	if (!params.platforms.includes('commonjs')) {
		params.platforms.push('commonjs'); // add commonjs to the list of valid module platforms
	}
	// Align the platform aliases for 'iphone'/'ipad'/'ios' to just be 'ios'
	// and remove duplicates
	params.platforms = Array.from(new Set(params.platforms.map(p => platformAliases[p] || p)));

	detect({
		searchPaths: params.searchPaths,
		bypassCache: params.bypassCache,
		logger: params.logger,
		callback: function (installed) {
			params.modules && params.modules.forEach(function (module) {
				const originalVersion = module.version || 'latest',
					scopes = [ 'project', 'global' ];

				// make sure the module has a valid array of platforms
				module.platform || (module.platform = params.platforms);
				Array.isArray(module.platform) || (module.platform = module.platform.split(','));

				module.deployType || (module.deployType = params.deployType);
				Array.isArray(module.deployType) || (module.deployType = module.deployType.split(','));

				// if this module doesn't support any of the platforms we're building for, skip it
				if (module.deployType.indexOf(params.deployType) === -1
					|| !module.platform.some(function (a) {
						return params.platforms.indexOf(a) !== -1;
					})) {
					return;
				}

				// strip all platforms that aren't supported by this build
				for (let i = 0; i < module.platform.length; i++) {
					if (params.platforms.indexOf(module.platform[i]) === -1) {
						module.platform.splice(i--, 1);
					} else if (platformAliases[module.platform[i]] && module.platform.indexOf(platformAliases[module.platform[i]]) === -1) {
						module.platform.push(platformAliases[module.platform[i]]);
					}
				}

				const key = module.id + '|' + module.deployType.join(',') + '|' + module.platform.join(',') + '|' + module.version;
				if (visited[key]) {
					return;
				}
				visited[key] = 1;

				params.logger && params.logger.debug(__('Looking for Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));

				// loop through each scope (project, global)
				let foundIncompatible, found;
				for (let i = 0; i < scopes.length; i++) {
					const scope = installed[scopes[i]];
					if (!scope) {
						continue;
					}

					// loop through each platform attribute from <module platform="ios,android">
					for (let j = 0; j < module.platform.length; j++) {
						const platform = module.platform[j];

						// check that we even have a module with the specified id and platform
						if (!scope[platform] || !scope[platform][module.id]) {
							continue;
						}

						// sort all versions
						Object.keys(scope[platform][module.id]).sort().reverse().filter(function (ver) {
							return !module.version || ver === module.version;
						}).forEach(function (ver) { // eslint-disable-line no-loop-func
							const info = scope[platform][module.id][ver];
							if (!info) {
								return;
							}

							const tmp = util.mix({}, module, info);
							if (params.sdkVersion && info.manifest && info.manifest.minsdk && version.gt(info.manifest.minsdk, params.sdkVersion)) {
								if (params.logger) {
									params.logger.debug(__('Found incompatible Titanium module id=%s version=%s platform=%s deploy-type=%s', tmp.id.cyan, tmp.version.cyan, tmp.platform.join(',').cyan, tmp.deployType.join(',').cyan));
									params.logger.debug(__('Module %s requires Titanium SDK %s or newer, but the selected SDK is %s', tmp.id.cyan, info.manifest.minsdk, params.sdkVersion));
								}
								result.incompatible.push(tmp);
								return;
							}

							if (moduleAPIVersion && moduleAPIVersion[platform] && info.manifest && info.manifest.apiversion && info.manifest.apiversion !== moduleAPIVersion[platform]) {
								if (params.logger) {
									params.logger.debug(__('Found incompatible Titanium module id=%s version=%s platform=%s api-version=%s deploy-type=%s', tmp.id.cyan, tmp.version.cyan, tmp.platform.join(',').cyan, String(info.manifest.apiversion).cyan, tmp.deployType.join(',').cyan));
									params.logger.debug(__('Module %s has apiversion=%s, but the selected SDK supports module apiversion=%s on platform=%s', tmp.id.cyan, info.manifest.apiversion.cyan, moduleAPIVersion[platform].cyan, platform.cyan));
								}
								result.incompatible.push(tmp);
								foundIncompatible = true;
								return;
							}

							// make sure we haven't already added this module
							let alreadyAdded = false,
								foundBetter = false,
								addToModuleMap = true;
							for (let k = 0; k < result.found.length; k++) {
								if (result.found[k].id === tmp.id) {
									// if we find a the same module twice, but the versions differ
									if (originalVersion === 'latest') {
										if (version.lt(result.found[k].version, ver)) {
											// found a better module
											params.logger && params.logger.info(__('Found better matching module id=%s version=%s platform=%s deploy-type=%s path=%s', tmp.id.cyan, originalVersion.cyan, tmp.platform.join(',').cyan, tmp.deployType.join(',').cyan, tmp.modulePath.cyan));
											result.found.splice(k, 1);
											foundBetter = true;
										} else if (version.eq(result.found[k].version, ver)) {
											alreadyAdded = true;
											if (result.found[k].platform.map(function (p) { return platformAliases[p] || p; }).indexOf(platformAliases[platform] || platform) !== -1) { // eslint-disable-line max-statements-per-line
												addToModuleMap = false;
											}
										} else {
											alreadyAdded = true;
										}
									} else if (version.eq(result.found[k].version, ver)) {
										alreadyAdded = true;
										if (result.found[k].platform.indexOf(platformAliases[platform] || platform) !== -1) {
											addToModuleMap = false;
										}
									}
								}
							}

							if (!alreadyAdded) {
								tmp.platform = [ platform ];
								!foundBetter && params.logger && params.logger.info(__('Found Titanium module id=%s version=%s platform=%s deploy-type=%s path=%s', tmp.id.cyan, tmp.version.cyan, tmp.platform.join(',').cyan, tmp.deployType.join(',').cyan, tmp.modulePath.cyan));
								result.found.push(tmp);
							}

							if (addToModuleMap) {
								// add this module to a hash so we can check later for conflicts
								modulesById[module.id] || (modulesById[module.id] = []);
								modulesById[module.id].push(tmp);
							}

							found = true;
						});
					}
				}

				if (!found) {
					params.logger && params.logger.warn(__('Could not find a valid Titanium module id=%s version=%s platform=%s deploy-type=%s', module.id.cyan, originalVersion.cyan, module.platform.join(',').cyan, module.deployType.join(',').cyan));
					// don't add to missing when the module is already in the incompatible list
					!foundIncompatible && result.missing.push(module);
				} else {
					// since we found a valid version, remove this module if was previously detected as incompatible
					// this happens when module version is 'latest', we iterated through the list of versions and found a compatible one
					// but subsequent versions are added to the incompatible list
					for (let x = 0; x < result.incompatible.length; x++) {
						if (result.incompatible[x].id === module.id) {
							result.incompatible.splice(x--, 1);
						}
					}
				}
			});

			// detect conflicts
			Object.keys(modulesById).forEach(function (id) {
				const mods = modulesById[id],
					len = mods.length;

				if (len <= 1) {
					return;
				}

				let commonJs = 0,
					nonCommonJs = 0;
				// we have a potential conflict...
				// verify that we have at least one commonjs platform and at least one non-commonjs platform
				for (let i = 0; i < len; i++) {
					platforms = Array.isArray(mods[i].platform) ? mods[i].platform : [ mods[i].platform ];
					platforms.forEach(function (p) { // eslint-disable-line no-loop-func
						if (p.toLowerCase() === 'commonjs') {
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

					// remove from found
					for (let i = 0; i < result.found.length; i++) {
						if (result.found[i].id === id) {
							result.found.splice(i--, 1);
						}
					}
				}
			});

			typeof params.callback === 'function' && params.callback(result);
		}
	});
}

/**
 * Automatically extracts a module zipfile if detect in module root dir.
 * @param {string} moduleRoot root directory where we store modules (parent of "modules" dir)
 * @param {string} name basename of zip file
 * @param {object} [logger] optional logger object
 * @return {Promise<void>}
 * @private
 */
async function unzipIfNecessary(moduleRoot, name, logger) {
	const zipRegExp = /^.+-.+?-.+?\.zip$/;
	const file = path.join(moduleRoot, name);
	if (!zipRegExp.test(name)) {
		return;
	}
	try {
		const stat = await fs.statSync(file);
		if (!stat.isFile()) {
			return;
		}
	} catch (e) {
		// ignore, no such file somehow
		return;
	}

	return new Promise(resolve => {
		logger && logger.info(__('Installing module: %s', name));
		zip.unzip(file, moduleRoot, null, function (err) {
			if (err) {
				logger && logger.error(__('Failed to unzip module "%s"', file));
			} else {
				fs.unlinkSync(file);
			}
			resolve();
		});
	});
}

/**
 * Searches a directory for Titanium modules. If it encounters a zip file
 * that matches module zip filename pattern, it will automatically unzip it and
 * remove the zip file prior to detecting modules.
 *
 * @param {String} modulesDir - A path/dir to search for Titanium modules.
 * @param {Object} [options] - An object with the following params.
 * @param {Boolean} [options.bypassCache=false] - When true, re-scans the specified path for modules.
 * @param {Function} [options.callback] - A function to call when done.
 * @param {Object} [options.config] - The CLI config.
 * @param {Object} [options.logger] - A logger instance.
 * @returns {Promise<object>}
 * @private
 */
async function detectModules(modulesDir, options = {}) {
	// make sure they specified a modulesDir
	if (!modulesDir) {
		throw new Error(__('Missing required argument "%s"', 'modulesDir'));
	}

	if (moduleCache[modulesDir] && !options.bypassCache) {
		return moduleCache[modulesDir];
	}

	const moduleRoot = path.resolve(modulesDir, '..');

	// make sure the module's parent dir (the root) exists
	if (!await fs.exists(moduleRoot)) {
		return {};
	}

	const logger = options.logger; // may be undefined!
	// auto-unzip zipped modules if we find them
	const fileNames = await fs.readdir(moduleRoot);
	await Promise.all(fileNames.map(name => unzipIfNecessary(moduleRoot, name, logger)));

	if (!await fs.exists(modulesDir)) {
		return {};
	}

	logger && logger.debug(__('Detecting modules in %s', modulesDir.cyan));

	const ignoreDirs = new RegExp(options.config && options.config.get('cli.ignoreDirs') || '^(.svn|.git|.hg|.?[Cc][Vv][Ss]|.bzr)$'); // eslint-disable-line security/detect-non-literal-regexp
	const osNamesRegExp = /^osx|win32|linux$/;

	const subdirs = await fs.readdir(modulesDir);
	// modules here is an array of object[], so we need to flatten it!
	const modules = flattenDeep(await Promise.all(subdirs.map(platform => detectPlatformModules(modulesDir, platform, osNamesRegExp, ignoreDirs, logger))));
	const result = convertArrayOfModulesToHierarchy(modules); // now nest into old hierarchy we returned

	return moduleCache[modulesDir] = result;
}

/**
 * @param {string} modulesDir i.e. '~/Library/APplication Support/Titanium/modules'
 * @param {string} platform i.e. 'android' or 'iphone'
 * @param {RegExp} osNamesRegExp regexp used to skip certain folder names like 'win32' or 'osx'
 * @param {RegExp} ignoreDirs additional regexp used to filter directories
 * @param {object} [logger] optional logger object
 * @returns {Promise<object[]>}
 * @private
 */
async function detectPlatformModules(modulesDir, platform, osNamesRegExp, ignoreDirs, logger) {
	const platformDir = path.join(modulesDir, platform);
	if (osNamesRegExp.test(platform) || ignoreDirs.test(platform)) {
		return [];
	}
	try {
		const stat = await fs.stat(platformDir);
		if (!stat.isDirectory()) {
			return [];
		}
	} catch (e) {
		// ignore if can't stat dir
		return [];
	}
	// ok, it's a valid platform dir!

	const moduleNameDirs = await fs.readdir(platformDir);
	// here we gather modules per-platform, which gives us object[] for each, so use of Promise.all gives us
	// an array of object[], so we need to flatten it once gathered
	const modules = await Promise.all(moduleNameDirs.map(moduleName => detectModulesByPlatformAndName(platformDir, moduleName, ignoreDirs, logger)));
	return flattenDeep(modules);
}

/**
 * @param {string} platformModulesDir i.e. '~/Library/Application Support/Titanium/modules/android'
 * @param {string} moduleName i.e. 'hyperloop'
 * @param {RegExp} ignoreDirs regexp used to filter directories traversed
 * @param {object} [logger] optional logger object
 * @returns {Promise<object[]>}
 * @private
 */
async function detectModulesByPlatformAndName(platformModulesDir, moduleName, ignoreDirs, logger) {
	if (ignoreDirs.test(moduleName)) {
		return [];
	}
	// loop through module names
	const modulePath = path.join(platformModulesDir, moduleName);
	try {
		const stat = await fs.stat(modulePath);
		if (!stat.isDirectory()) {
			return [];
		}
	} catch (e) {
		return [];
	}

	const versionDirs = await fs.readdir(modulePath);
	const modules = await Promise.all(versionDirs.map(ver => detectModule(modulePath, ver, ignoreDirs, logger)));
	return modules.filter(m => m); // returns object[], removing nulls
}

/**
 * @param {string} modulePath parent directory (path to module dir holding name of module)
 * @param {string} ver basename of current dir holding the module (name is version number of module)
 * @param {RegExp} ignoreDirs regexp used to filter directories traversed
 * @param {object} [logger] optional logger object
 * @returns {Promise<null|object>}
 * @private
 */
async function detectModule(modulePath, ver, ignoreDirs, logger) {
	if (ignoreDirs.test(ver)) {
		return null;
	}

	const versionPath = path.join(modulePath, ver);
	const manifestFile = path.join(versionPath, 'manifest');
	if (!await fs.exists(manifestFile)) {
		return null;
	}

	const mod = {
		version: ver,
		modulePath: versionPath,
		manifest: {}
	};

	const manifestContents = await fs.readFile(manifestFile, 'utf8');
	manifestContents.split('\n').forEach(line => {
		const p = line.indexOf(':');
		if (line.charAt(0) !== '#' && p !== -1) {
			mod.manifest[line.substring(0, p)] = line.substring(p + 1).trim();
		}
	});

	if (mod.manifest.platform) {
		mod.manifest.platform = platformAliases[mod.manifest.platform] || mod.manifest.platform;
		mod.platform = [ mod.manifest.platform ];
	}
	// TODO: sanity check that ver === mod.manifest.version?

	logger && logger.debug(__('Detected %s module: %s %s @ %s', mod.platform[0], mod.manifest.moduleid.cyan, ver, mod.modulePath));
	return mod;
}

/**
 *
 * @param {string[]} searchPaths the list of directories to consider. This is assumed to be the full absolute path to node_modules folder(s)
 * @return {object[]}
 */
async function detectNodeModules(searchPaths) {
	const results = await Promise.all(searchPaths.map(dir => detectNativeModulesViaNodeModulesDir(dir)));
	const flattened = flattenDeep(results); // flatten nested arrays down
	return flattened.filter(item => item !== null); // remove nulls
}

/**
 *
 * @param {string} nodeModuleDir path to a single node_modules directory to search
 * @returns {object[]} the representations of the modules found
 * @private
 */
async function detectNativeModulesViaNodeModulesDir(nodeModuleDir) {
	// List top-level directories under node_modules (or scoped packages dir)
	try {
		const subDirs = await fs.readdir(nodeModuleDir);
		// for each dir, try and collect module data (or null)
		const promises = subDirs.map(dir => {
			if (dir.startsWith('@')) { // scoped package, recurse!
				return detectNativeModulesViaNodeModulesDir(path.join(nodeModuleDir, dir));
			} else {
				return detectNativeModuleViaNPMPackage(path.join(nodeModuleDir, dir));
			}
		});
		return Promise.all(promises);
	} catch (e) {
		return []; // folder may not exist!
	}
}

/**
 * @param {string} singlePackageDir the npm package directory to look at (child of 'node_modules' or scoped package dir)
 * @returns {object|null} null if no native module found; otherwise an object with metadata about the module.
 * @private
 */
async function detectNativeModuleViaNPMPackage(singlePackageDir) {
	// is this given package a native module?
	try {
		const json = await fs.readJSON(path.join(singlePackageDir, 'package.json'));
		if (json && json.titanium && json.titanium.moduleid && json.titanium.type === 'native-module') {
			// Hey! it's a native module for us!
			let platform = json.titanium.platform;
			if (platformAliases[platform]) {
				platform = platformAliases[platform];
			}
			return {
				id: json.titanium.moduleid,
				modulePath: singlePackageDir,
				platform: [ platform ],
				version: json.version,
				manifest: {
					name: json.titanium.name,
					minsdk: json.titanium.minsdk,
					apiversion: json.titanium.apiversion,
					guid: json.titanium.guid,
					moduleid: json.titanium.moduleid,
					architectures: json.titanium.architectures
				}
			};
		}
	} catch (e) {
		// ignore if we failed to find/read a package.json file!
	}
	return null;
}

/**
 * @param {object[]} modules array of all the distinct modules found
 * @returns {object} the modules re-aligned into a tree structure: platform -> name -> version -> module object
 */
function convertArrayOfModulesToHierarchy(modules) {
	const result = {};
	modules.forEach(m => {
		const platform = m.platform[0];
		// FIXME: For whatever reason this code grouped by module name and not id!
		// This seems wrong to me, as we should really be combining entries based on the id, not the name
		// But for now, fixing this to group by moduleid breaks tests which assume the name is used (and some questionable test fixture data)
		const name = m.manifest.name;
		const version = m.version;
		result[platform] = (result[platform] || {});
		result[platform][name] = (result[platform][name] || {});
		result[platform][name][version] = m;
	});
	return result;
}

/**
 * @param {array} arr1 array
 * @returns {array}
 * @private
 */
function flattenDeep(arr1) {
	return arr1.reduce((acc, val) => {
		return Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val);
	}, []);
}
