/**
 * Parses projects for i18n strings into locale/en.js files, prepares
 * locale/en.js files for manual upload to webtranslateit.com, and
 * fetches and applies i18n strings from webtranslateit.com.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var fs = require('fs-extra'),
	path = require('path'),
	appc = require('../../index'),
	UglifyJS = require('uglify-js'),
	colors = require('colors'),
	diff = require('diff'),
	request = require('request'),
	async = require('async'),
	temp = require('temp'),
	http = require('http'),
	AdmZip = require('adm-zip'),
	actions = {};

module.exports = function (action) {
	var configFile = path.join(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'i18n-tool.json'),
		config;

	console.log('i18n Tool'.cyan.bold + ' - Copyright (c) 2012-' + (new Date).getFullYear() + ', Appcelerator, Inc.  All Rights Reserved.\n');

	if (!action || !actions[action] || process.argv.indexOf('help') != -1 || process.argv.indexOf('--help') != -1 || process.argv.indexOf('-h') != -1) {
		console.log('Usage: ' + 'forge i18n <action> [options]'.cyan + '\n');
		action && console.error(('ERROR: Invalid action "' + action + '"\n').red);
		console.log('Available actions:');
		Object.keys(actions).sort().forEach(function (a) {
			console.log('   ' + appc.string.rpad(a, 7).cyan + ' - ' + actions[a].desc);
		});
		console.log();
		process.exit(action ? 1 : 0);
	}

	if (!fs.existsSync(configFile)) {
		console.error('ERROR: Config file does not exist\n'.red);
		console.error('Copy ' + path.join(__dirname, 'i18n-sync.example.json') + ' to ' + configFile + ', then edit the file and configure the private key and project paths.\n');
		process.exit(1);
	}

	// load the config file
	try {
		config = JSON.parse(fs.readFileSync(configFile));
	} catch (ex) {
		console.error(('ERROR: Failed to parse config file\n\n' + ex + '\n').red);
		process.exit(1);
	}

	// validate the config
	if (!config || typeof config != 'object') {
		console.error('ERROR: Config file is malformed\n'.red);
		process.exit(1);
	}

	if (!config.cli || typeof config.cli != 'object') {
		console.error('ERROR: Config file does not have a valid "cli" property\n'.red);
		process.exit(1);
	}

	if (!config.cli.privateKey || typeof config.cli.privateKey != 'string') {
		console.error('ERROR: Config file does not have a valid webtranslateit.com private key\n'.red);
		process.exit(1);
	}

	if (!config.cli.projects || typeof config.cli.projects != 'object') {
		console.error('ERROR: Config file does not have a valid "cli.projects" property\n'.red);
		process.exit(1);
	}

	Object.keys(config.cli.projects).forEach(function (project) {
		if (!fs.existsSync(config.cli.projects[project])) {
			console.error(('ERROR: Could not locate project "' + project + '"\n\n' + config.cli.projects[project] + ' does not exist\n').red);
			process.exit(1);
		}
	});

	actions[action](config);
};

/**
 * Analyzes all projects for i18n function calls and creates the project-
 * specific en.js files.
 * @param {Object} config - The i18n config
 * @param {Boolean} writeMode - If true, writes the changes to disk
 */
function doAnalyze(config, writeMode) {
	var projects = config.cli.projects,
		masterList = {},
		anyChanges = false;

	console.log('Analyzing projects...');

	Object.keys(projects).sort().forEach(function (project) {
		var entries = {},
			strings = [],
			files = {},
			jsfile = /\.js$/,
			scannable = /^(lib|plugins|commands|hooks)$/,
			i18nFunctionRegex = /^__[fn]?$/,
			changes = false;

		console.log(project + (' (' + projects[project] + ')').grey);

		(function walk(dir, depth) {
			fs.readdirSync(dir).forEach(function (name) {
				var file = path.join(dir, name);
				if (!fs.existsSync(file)) return;

				if (fs.statSync(file).isDirectory()) {
					if (depth || scannable.test(name)) {
						walk(file, (depth | 0) + 1);
					}
				} else if (jsfile.test(name)) {
					process.stdout.write('  ' + file.replace(projects[project], '').cyan + ': ');

					try {
						var numStringsFound = 0,
							i18nFunction,
							depth = -1,
							argCounter = 0,
							walker = new UglifyJS.TreeWalker(function (node, descend) {
								if (node instanceof UglifyJS.AST_SymbolRef) {
									i18nFunction = node.name.match(i18nFunctionRegex);
									if (i18nFunction) {
										//console.log(walker.stack.length, '[' + require('../../index').ast.getType(node).join(', ') + ']', node.name, '!!!!!!!!!!!!!!!!!!!!');
										if (i18nFunction == '__') {
											strings.push('');
										} else if (i18nFunction == '__n') {
											strings.push({
												one: '',
												other: ''
											});
										}
										argCounter = i18nFunction[0] == '__n' ? 2 : 1;
										depth = walker.stack.length;
									}
								} else if (node instanceof UglifyJS.AST_String && i18nFunction && walker.stack.length == depth) {
									//console.log(walker.stack.length, '[' + require('../../index').ast.getType(node).join(', ') + ']', i18nFunction[0], node.value);
									if (i18nFunction == '__') {
										strings[strings.length-1] += node.value;
										numStringsFound++;
										i18nFunction = null;
										depth = -1;
									} else if (i18nFunction == '__f') {
										var f = path.join(projects[project], 'locales', node.value, 'en.txt');
										if (fs.existsSync(f)) {
											files['<file:' + project + '/' + node.value + '>'] = fs.readFileSync(f).toString();
											numStringsFound++;
										} else {
											files[node.value] = null;
										}
										i18nFunction = null;
										depth = -1;
									} else if (i18nFunction == '__n') {
										strings[strings.length-1][argCounter == 2 ? 'one' : 'other'] += node.value;
										argCounter--;
										numStringsFound++;
									} else if (argCounter <= 0) {
										i18nFunction = null;
										depth = -1;
									}
								} else {
									i18nFunction = null;
									depth = -1;
								}
							});

						UglifyJS.parse(fs.readFileSync(file).toString(), { filename: file }).walk(walker);

						process.stdout.write('found ' + (''+numStringsFound).magenta + ' string' + (numStringsFound != 1 ? 's' : '') + '\n');
					} catch (ex) {
						process.stdout.write('failed to parse file\n'.red);
					}
				}
			});
		}(projects[project]));

		strings.forEach(function (s) {
			if (s) {
				entries[typeof s == 'object' ? s.one : s] = s;
				masterList[typeof s == 'object' ? s.one : s] = s;
			}
		});

		Object.keys(files).forEach(function (name) {
			files[name] && (masterList[name] = name + files[name]);
		});

		var localesDir = path.join(projects[project], 'locales'),
			i18nFile = path.join(localesDir, 'en.js'),
			newContents = JSON.stringify(entries, null, '\t');

		fs.ensureDirSync(localesDir);
		
		if (fs.existsSync(i18nFile)) {
			var oldContents = fs.readFileSync(i18nFile).toString(),
				output = diff.createPatch(i18nFile, oldContents, newContents).trim().split('\n').slice(2).map(function (line) {
					return '  ' + (line.length && line[0] == '+' ? line.green : line.length && line[0] == '-' ? line.red : line);
				});
			console.log('\n' + (output.length > 2 ? output.join('\n') : '  No changes detected') + '\n');
			if (output.length > 2) {
				anyChanges = changes = true;
			}
		} else {
			anyChanges = changes = true;
		}

		if (writeMode && changes) {
			fs.writeFileSync(i18nFile, newContents);
			console.log('Saved changes to ' + i18nFile.cyan + '\n');
		}

		console.log();
	});

	if (!writeMode && anyChanges) {
		console.log('Updates detected, but nothing was saved. You must run ' + ('forge i18n analyze --write').cyan + ' to save updates.\n');
	}

	return masterList;
}

/**
 * Scans all projects in the config file for i18n strings, then writes them to
 * each project's locales/en.js file.
 * @param {Object} config - The i18n config
 */
actions.analyze = function (config) {
	var startTime = Date.now();
	doAnalyze(config, process.argv.indexOf('--write') != -1);
	console.log('Projects analyzed successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
};
actions.analyze.desc = 'scans project files for i18n strings and updates their locale/en.js file';

/**
 * Assembles all project's locales/en.js files into a single master locale file
 * for manual upload to webtranslateit.org.
 */
actions.prepare = function (config) {
	var startTime = Date.now(),
		masterList = doAnalyze(config, process.argv.indexOf('--write') != -1),
		dest = process.argv.slice(4).shift() || path.join(process.cwd(), 'en-us.js'),
		dir = path.dirname(/\.js$/.test(dest) ? dest : dest = path.join(dest, 'en-us.js'));

	fs.ensureDirSync(dir);
	console.log('Writing ' + dest.cyan + '\n');
	fs.writeFileSync(dest, JSON.stringify(masterList, false, '\t'));

	console.log('Master i18n file assembled successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
};
actions.prepare.desc = "builds a master locale file from each project's locale/en.js files";

/**
 * Downloads the i18n zip file into a temp directory and fires the callback with
 * the path to that zip file.
 */
function downloadI18NZip(url, callback) {
	var tempName = temp.path({ suffix: '.zip' }),
		tempStream = fs.createWriteStream(tempName),
		req = request({
			url: url
		});

	req.pipe(tempStream);

	req.on('error', function (err) {
		afs.exists(tempName) && fs.unlinkSync(tempName);
		console.error('\n' + __('Failed to download zip file: %s', err.toString()) + '\n');
		process.exit(1);
	});

	req.on('response', function (req) {
		if (req.statusCode >= 400) {
			console.error('\n' + __('Request failed with HTTP status code %s %s', req.statusCode, http.STATUS_CODES[req.statusCode] || '') + '\n');
			process.exit(1);
		} else {
			tempStream.on('close', function () {
				callback(tempName);
			});
		}
	});
}

/**
 * Fetches the latest i18n strings from webtranslateit.com, then updates each
 * project's i18n files.
 */
actions.pull = function (config) {
	var startTime = Date.now(),
		writeMode = process.argv.indexOf('--write') != -1;

	console.log('Fetching i18n strings...');
	downloadI18NZip('https://webtranslateit.com/api/projects/' +  config.cli.privateKey + '/zip_file', function (zipFile) {
		console.log('Downloaded zip to ' + zipFile.cyan);

		var zip = new AdmZip(zipFile),
			tempDir = path.join(path.dirname(zipFile), 'i18n_zip_' + Date.now());

		console.log('Extracting zip to ' + tempDir.cyan);
		zip.extractAllTo(tempDir, true);

		console.log('Removing zip file ' + zipFile.cyan);
		fs.unlinkSync(zipFile);

		console.log('Reading in i18n string files...');

		var projectI18N = {},
			localeI18N = {};

		async.parallel([
			// load all project en.js files
			function (next) {
				async.parallel(Object.keys(config.cli.projects).map(function (project) {
					return function (cb) {
						try {
							projectI18N[project] = JSON.parse(fs.readFileSync(path.join(config.cli.projects[project], 'locales', 'en.js')));
						} catch (ex) {
							projectI18N[project] = {};
						}
						cb();
					};
				}), next);
			},
			// load all extracted i18n files
			function (next) {
				async.parallel(fs.readdirSync(tempDir).filter(function (name) {
					// skip en-us
					return fs.existsSync(path.join(tempDir, name)) && name.indexOf('en') != 0;
				}).map(function (name) {
					return function (cb) {
						var file = path.join(tempDir, name),
							i, json,
							result = {};
						try {
							json = JSON.parse(fs.readFileSync(file));
							for (i in json) {
								if (json[i]) {
									if (typeof json[i] == 'string') {
										result[i] = json[i];
									} else if (typeof json[i] == 'object') {
										if (json[i].one) {
											result[i] || (result[i] = {});
											result[i].one = json[i].one;
										}
										if (json[i].other) {
											result[i] || (result[i] = {});
											result[i].other = json[i].other;
										}
									}
								}
							}
							localeI18N[name.substring(0, 2)] = result;
						} catch (ex) {
							console.error(('ERROR: Failed to parse ' + file).red);
						}
						cb();
					};
				}), next);
			}
		], function () {
			// projectI18N and localeI18N should be primed and ready to go

			var fileRegex = /^(<file\:([^/]+)\/([^>]+)>)/,
				anyChanges = false;

			console.log('Applying strings to project i18n files...\n');

			// for each locale file & project, we need to define the new locale file
			Object.keys(localeI18N).forEach(function (locale) {
				Object.keys(projectI18N).forEach(function (project) {
					var dest = path.join(config.cli.projects[project], 'locales', locale + '.js'),
						newLocaleFile = {},
						files = {},
						changes = false,
						oldContents,
						newContents,
						output;

					console.log(dest.cyan);

					Object.keys(localeI18N[locale]).forEach(function (name) {
						var m = name.match(fileRegex);
						// see if this key is a file-based string
						if (m && m[2] == project) {
							files[m[3]] = localeI18N[locale][name].replace(fileRegex, '');

						// check that this project even has this string
						} else if (!m && projectI18N[project][name]) {
							newLocaleFile[name] = localeI18N[locale][name];
						}
					});

					// first do the .js string file
					newContents = JSON.stringify(newLocaleFile, null, '\t');
					oldContents = fs.existsSync(dest) ? fs.readFileSync(dest).toString() : '';
					output = diff.createPatch(dest, oldContents, newContents).trim().split('\n').slice(2).map(function (line) {
						return '  ' + (line.length && line[0] == '+' ? line.green : line.length && line[0] == '-' ? line.red : line);
					});
					console.log(output.length > 2 ? output.join('\n') : '  No changes detected');
					if (output.length > 2) {
						anyChanges = changes = true;
					}
					if (writeMode && changes) {
						fs.writeFileSync(dest, newContents);
						console.log('Saved changes to ' + dest.cyan + '\n');
					}

					console.log();

					// next do the files
					if (Object.keys(files).length) {
						Object.keys(files).forEach(function (file) {
							var changes = false,
								dest = path.join(config.cli.projects[project], 'locales', file, locale + '.txt'),
								newContents = files[file],
								oldContents = fs.existsSync(dest) ? fs.readFileSync(dest).toString() : '',
								output = diff.createPatch(dest, oldContents, newContents).trim().split('\n').slice(2).map(function (line) {
									return '  ' + (line.length && line[0] == '+' ? line.green : line.length && line[0] == '-' ? line.red : line);
								});
							console.log(dest.cyan);
							console.log(output.length > 2 ? output.join('\n') : '  No changes detected');
							if (output.length > 2) {
								anyChanges = changes = true;
							}
							if (writeMode && changes) {
								fs.writeFileSync(dest, newContents);
								console.log('Saved changes to ' + dest.cyan + '\n');
							}
						});

						console.log();
					}
				});
			});

			console.log('Removing temp folder ' + tempDir.cyan + '\n');
			fs.removeSync(tempDir);

			if (!writeMode && anyChanges) {
				console.log('Updates detected, but nothing was saved. You must run ' + ('forge i18n pull --write').cyan + ' to save updates.\n');
			}

			console.log('Fetched latest i18n strings and updated i18n files successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
		});
	});
};
actions.pull.desc = 'fetches i18n strings from the Titanium CLI webtranslateit.com and updates locale files';
