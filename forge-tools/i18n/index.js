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

var fs = require('fs'),
	path = require('path'),
	appc = require('../../index'),
	wrench = require('wrench'),
	UglifyJS = require('uglify-js'),
	colors = require('colors'),
	diff = require('diff'),
	request = require('request'),
	async = require('async'),
	wtiUrl = 'https://webtranslateit.com/api/projects/',
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
											files[node.value] = fs.readFileSync(f).toString();
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
			files[name] && (masterList['<file:' + name + '>' + files[name]] = '<file:' + name + '>' + files[name]);
		});

		var localesDir = path.join(projects[project], 'locales'),
			i18nFile = path.join(localesDir, 'en.js'),
			newContents = JSON.stringify(entries, null, '\t');

		if (!fs.existsSync(localesDir)) {
			wrench.mkdirSyncRecursive(localesDir);
		}

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
		console.log('Updates detected. It is highly recommend you run ' + ('forge i18n analyze --write').cyan + '.\n');
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

	fs.existsSync(dir) || wrench.mkdirSyncRecursive(dir);
	console.log('Writing ' + dest.cyan + '\n');
	fs.writeFileSync(dest, JSON.stringify(masterList, false, '\t'));

	console.log('Master i18n file assembled successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
};
actions.prepare.desc = "builds a master locale file from each project's locale/en.js files";

/**
 * Fetches the latest i18n strings from webtranslateit.com, then updates each
 * project's i18n files.
 */
actions.pull = function (config) {
	var startTime = Date.now(),
		locales = [],
		strings = [],
		transferAmount = 0;

	console.log('Fetching remote project information...');

	async.parallel([
		// Get the list of locales from webtranslateit.com
		function (next) {
			request(wtiUrl + config.cli.privateKey + '.json', function (error, response, body) {
				if (body) {
					transferAmount += body.length;
				}
				if (error) {
					next('Could not fetch the webtranslateit.com information: ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the webtranslateit.com information: server returned ' +
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the webtranslateit.com information: server returned ' + response.statusCode + '\n');
					}
				} else {
					try {
						body = JSON.parse(body);
						if (body.error) {
							next('Could not fetch the webtranslateit.com information: ' + body.error);
						}
						if (body.project && body.project.target_locales) {
							body.project.target_locales.forEach(function (locale) {
								locales.push(locale.code);
							});
							next();
						} else {
							next('Could not fetch the webtranslateit.com information: invalid server response');
						}
					} catch(e) {
						next('Could not parse the webtranslateit.com locale response: ' + e);
					}
				}
			});
		},

		// Get the list of strings from webtranslateit.com
		function (next) {
			request(wtiUrl + config.cli.privateKey + '/strings', function (error, response, body) {
				if (body) {
					transferAmount += body.length;
				}
				if (error) {
					next('Could not fetch the webtranslateit.com strings: ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the webtranslateit.com information: server returned ' +
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the webtranslateit.com information: server returned ' + response.statusCode + '\n');
					}
				} else {
					try {
						body = JSON.parse(body);
						if (body.error) {
							next('Could not fetch the webtranslateit.com information: ' + body.error);
						}
						body.forEach(function (str) {
							strings.push(str.id);
						});
						next();
					} catch(e) {
						next('Could not parse the webtranslateit.com string response: ' + e);
					}
				}
			});
		}
	], function (err) {
		if (err) {
			console.error(err);
			process.exit(1);
		}

		var numRequests = locales.length * strings.length,
			localeTasks = [],
			pb = new appc.progress('  :paddedPercent [:bar] :etas', {
				complete: '=',
				incomplete: '.',
				width: 40,
				total: numRequests
			}),
			translations = {};

		console.log(' Fetched ' + locales.length + ' locales and ' + strings.length + ' strings\n');
		console.log('Fetching remote i18n translations...');
		pb.tick(1);

		locales.forEach(function (locale) {
			translations[locale] = {};
			localeTasks.push(function (localeNext) {
				var stringTasks = [];
				strings.forEach(function (str) {
					stringTasks.push(function (strNext) {
						request(wtiUrl + config.cli.privateKey + '/strings/' + str + '/locales/' + locale + '/translations.json', function (error, response, body) {
							if (body) {
								transferAmount += body.length;
							}
							if (error) {
								strNext('Could not fetch the translations for "' + str + '": ' + error);
							} else if (response.statusCode !== 200) {
								try {
									strNext('Could not fetch the translations for "' + str + '": server returned ' +
										response.statusCode + ': ' + JSON.parse(body).error + '\n');
								} catch(e) {
									strNext('Could not fetch the translations for "' + str + '": server returned ' + response.statusCode + '\n');
								}
							} else {
								body = JSON.parse(body);
								if (body.error) {
									strNext('Could not fetch the translations for "' + str + '": ' + body.error);
								}
								if (body.text) {
									translations[locale][body.string.key] = body.text;
								}
								strNext();
							}
							pb.tick(1);
						});
					});
				});
				async.parallel(stringTasks, function (err, result) {
					localeNext(err, result);
				});
			});
		});

		async.parallel(localeTasks, function (err) {
			if (err) {
				console.error();
				console.error(err);
				console.error();
				process.exit(1);
			}

			console.log('\n  ' + (transferAmount / 1000).toFixed(0) + ' kb transferred in ' +
				((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\nAssembling local locale files');

			var numLocalesAssembled = 0;

			async.parallel(Object.keys(projects).map(function (projectName) {
				return function (projectNext) {
					console.log('  Assembling locale files for ' + projectName);
					var masterLocaleFilePath = path.join(projects[projectName], 'locales', 'en.js'),
						masterLocale,
						str,
						targetLocale;

					try {
						masterLocale = JSON.parse(fs.readFileSync(masterLocaleFilePath));
					} catch(e) {
						projectNext('Could not parse master locale file for ' + projectName + ': ' + e.message);
						return;
					}

					locales.forEach(function (locale) {
						if (locale !== 'en') {
							targetLocale = {};
							for (str in masterLocale) {
								targetLocale[str] = translations[locale] && translations[locale][str];
							}
							//fs.writeFileSync(path.join(projects[projectName], 'locales', locale + '.js'), JSON.stringify(targetLocale, false, '\t'));
							console.log(path.join(projects[projectName], 'locales', locale + '.js'));
							console.log(JSON.stringify(targetLocale, false, '\t'));
							numLocalesAssembled++;
						}
					});
					projectNext();
				};
			}), function (err) {
				if (err) {
					console.error();
					console.error(err);
					console.error();
					process.exit(1);
				}

				console.log('  Assembled ' + numLocalesAssembled + ' locale files\n');
				console.log('Updated i18n files successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
			});
		});
	});
};
actions.pull.desc = 'fetches i18n strings from the Titanium CLI webtranslateit.com and updates locale files';


/*
CB: Below is the old, unfinished "push" code that is supposed to uploads the
    master i18n list to webtranslateit.com. This is possible a bad idea and
    maybe forcing the master list to manually be uploaded is a wise thing to
    do. Who knows?

var requestInfoTasks = [],
	transferAmount = 0;
console.log('Fetching remote project information');
request(wtiUrl + config.cli.privateKey + '.json', function (error, response, body) {
	var i, len,
		masterFileId;
	body && (transferAmount += body.length);
	if (error) {
		console.log('Could not fetch the remote information: ' + error + '\n');
	} else if (response.statusCode !== 200) {
		console.log('Could not fetch the remote information: server returned ' + response.statusCode + '\n');
	} else {
		body = JSON.parse(body);
		if (body.error) {
			next('Could not fetch the remote information: ' + body.error);
		} else if (body.project && body.project.project_files && body.project.project_files) {
			for (i = 0, len = body.project.project_files.length; i < len; i++) {
				if (body.project.project_files[i].name === 'en.js') {
					masterFileId = body.project.project_files[i].id;

					console.log('Uploading master file to remote');
					request({
						method: 'PUT',
						uri: wtiUrl + config.cli.privateKey + '/files/' + masterFileId + '/locales/en',
						'content-type': 'application/json',
						body: JSON.stringify({
							file: masterList,
							name: 'en.js'
						})
					}, function (error, response, body) {
						body && (transferAmount += body.length);
						if (error) {
							console.log('Could not fetch the remote information: ' + error + '\n');
						} else if (response.statusCode !== 200) {
							console.log(body);
							try {
								console.log('Could not fetch the remote information: server returned ' +
									response.statusCode + ': ' + JSON.parse(body).error + '\n');
							} catch(e) {
								console.log('Could not fetch the remote information: server returned ' + response.statusCode + '\n');
							}
						} else {
							console.log(body);
						}
					});

					break;
				}
			}
		} else {
			console.log('Could not fetch the remote information: invalid server response\n');
		}
	}
});*/
