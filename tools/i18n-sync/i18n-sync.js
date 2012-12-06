#!/usr/bin/env node

var fs = require('fs'),
	path = require('path'),

	request = require('request'),
	async = require('async'),
	wrench = require('wrench'),
	
	progress = require('../../lib/progress'),
	
	configFile = path.join(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'i18n-sync.json'),
	config,
	projects,
	privateKey,
	
	wtiPrefix = 'https://webtranslateit.com/api/projects/',
	
	command = process.argv[2],
	
	startTime = Date.now();

// Load the config file
console.log();
try {
	config = JSON.parse(fs.readFileSync(configFile));
} catch(e) {
	console.error('Error reading the config file');
	console.error(e.message + '\n');
	process.exit(1);
}
switch(command) {
	case 'push':
		validateConfig();
		push();
		break;
	case 'pull':
		validateConfig();
		pull();
		break;
	case 'analyze':
		validateConfig();
		analyze();
		break;
	case 'help':
	case '--help':
		printUsage();
		break;
	default:
		if (command) {
			console.error('Invalid command: ' + command + '\n');
		} else {
			console.error('Missing command\n');
		}
		printUsage();
		process.exit();
		break;
}

function validateConfig() {
	if ('cli' in config && 'projects' in config.cli) {
		for(var p in config.cli.projects) {
			if (!fs.existsSync(config.cli.projects[p])) {
				console.error('Could not locate project ' + p + ': ' + config.cli.projects[p] + ' does not exist\n');
				process.exit(1);
			}
		}
	} else {
		console.error('Project information is missing from the config file');
		process.exit(1);
	}
	projects = config.cli.projects;
	privateKey = config.cli.privateKey;
	if (!privateKey) {
		console.error('Private key is missing from the config file');
		process.exit(1);
	}
}

function printUsage() {
	console.log('Usage: i18n-sync [command]\n\n' +
		'commands:\n' +
		'   push     Assembles the global master locale file from the projects and pushes it to Web Translate It\n' +
		'   pull     Pulls all locale information from Web Translate It and creates the per-project locale files\n' +
		'   analyze  Analyzes a project\n');
}

function push() {
	var masterList = {};
	
	console.log('Generating master language file for remote');
	Object.keys(projects).forEach(function (projectName) {
		var localeFilePath = path.join(projects[projectName], 'locales', 'en.js'),
			localeFile,
			p;
		try {
			localeFile = JSON.parse(fs.readFileSync(localeFilePath));
		} catch(e) {
			console.error('Could not parse locale file ' + localeFilePath + ': ' + e.message);
			process.exit(1);
		}
		for(p in localeFile) {
			masterList[p] = p;
		}
	});
	
	console.log('Writing master language file\n	');
	fs.writeFileSync('en.js', JSON.stringify(masterList, false, '\t'));
	
	console.log('Pushing to Web Translate It is not yet suppported. Please upload the master locale file manually. ' +
		'The assembled file can be found at ' + path.resolve('en.js'));
	/*
	var requestInfoTasks = [],
		transferAmount = 0;

	console.log('Fetching remote project information');
	request(wtiPrefix + privateKey + '.json', function (error, response, body) {
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
				for(i = 0, len = body.project.project_files.length; i < len; i++) {
					if (body.project.project_files[i].name === 'en.js') {
						masterFileId = body.project.project_files[i].id;
						
						console.log('Uploading master file to remote');
						request({
							method: 'PUT',
							uri: wtiPrefix + privateKey + '/files/' + masterFileId + '/locales/en',
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
}

// Pulls the web translate it information from the cloud and parses it out into each of the projects
function pull() {
	var locales = [],
		strings = [],
		transferAmount = 0;

	console.log('Fetching remote project information');
	async.parallel([
			
		// Get the list of locales from Web Translate It
		function (next) {
			request(wtiPrefix + privateKey + '.json', function (error, response, body) {
				if (body) {
					transferAmount += body.length;
				}
				if (error) {
					next('Could not fetch the Web Translate It information: ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the Web Translate It information: server returned ' +
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the Web Translate It information: server returned ' + response.statusCode + '\n');
					}
				} else {
					try {
						body = JSON.parse(body);
						if (body.error) {
							next('Could not fetch the Web Translate It information: ' + body.error);
						}
						if (body.project && body.project.target_locales) {
							body.project.target_locales.forEach(function(locale) {
								locales.push(locale.code);
							});
							next();
						} else {
							next('Could not fetch the Web Translate It information: invalid server response');
						}
					} catch(e) {
						next('Could not parse the Web Translate It locale response: ' + e);
					}
				}
			});
		},
			
		// Get the list of strings from Web Translate It
		function (next) {
			request(wtiPrefix + privateKey + '/strings', function (error, response, body) {
				if (body) {
					transferAmount += body.length;
				}
				if (error) {
					next('Could not fetch the Web Translate It strings: ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the Web Translate It information: server returned ' +
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the Web Translate It information: server returned ' + response.statusCode + '\n');
					}
				} else {
					try {
						body = JSON.parse(body);
						if (body.error) {
							next('Could not fetch the Web Translate It information: ' + body.error);
						}
						body.forEach(function (str) {
							strings.push(str.id);
						});
						next();
					} catch(e) {
						next('Could not parse the Web Translate It string response: ' + e);
					}
				}
			});
		}
	], function(err) {
		if (err) {
			console.error(err);
			process.exit(1);
		} else {
			var numRequests = locales.length * strings.length,
				localeTasks = [],
				pb = new progress('  :paddedPercent [:bar] :etas', {
					complete: '=',
					incomplete: '.',
					width: 65,
					total: numRequests
				}),
				translations = {};
			
			console.log(' Fetched ' + locales.length + ' locales and ' + strings.length + ' strings\nFetching remote internationalization information');
			pb.tick(1);
			locales.forEach(function (locale) {
				translations[locale] = {};
				localeTasks.push(function (localeNext) {
					var stringTasks = [];
					strings.forEach(function (str) {
						stringTasks.push(function (strNext) {
							request(wtiPrefix + privateKey + '/strings/' + str + '/locales/' + locale + '/translations.json', function (error, response, body) {
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
					async.parallel(stringTasks, function(err, result) {
						localeNext(err, result);
					});
				});
			});
			async.parallel(localeTasks, function(err) {
				
				if (err) {
					console.error(err);
					process.exit(1);
				} else {
					var projectTasks = [],
						numLocalesAssembled = 0;
					
					console.log('\n  ' + (transferAmount / 1000).toFixed(0) + ' kb transferred in ' +
						((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\nAssembling local locale files');
					Object.keys(projects).forEach(function (projectName) {
						projectTasks.push(function(projectNext) {
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
									for(str in masterLocale) {
										targetLocale[str] = translations[locale] && translations[locale][str];
									}
									fs.writeFileSync(path.join(projects[projectName], 'locales', locale + '.js'),
										JSON.stringify(targetLocale, false, '\t'));
									numLocalesAssembled++;
								}
							});
							projectNext();
						});
					});
				
					async.parallel(projectTasks, function(err) {
						if (err) {
							console.log('\n',err);
						} else {
							console.log('  Assembled ' + numLocalesAssembled + ' locale files\n\nSuccessfully pulled all remote i18n data\n');
						}
					});
				}
			});
		}
	});
}

function analyze() {
	var astWalker = require('../../lib/astwalker'),
		jsExtensionRegex = /\.js$/,
		dirWhiteList = /^(lib|plugins|commands|hooks)/;
	
	Object.keys(projects).forEach(function (projectName) {
		var masterList = {},
			files,
			file,
	
			i = 0, len,
			
			sourceDir = projects[projectName],
			localesDir = path.join(sourceDir, 'locales');
		
		console.log('Processing local project ' + projectName);
		files = wrench.readdirSyncRecursive(sourceDir);
		for(len = files.length; i < len; i++) {
			file = path.join(sourceDir, files[i]);
			if (jsExtensionRegex.test(file) && dirWhiteList.test(path.dirname(files[i]))) {
				processFile(file);
			}
		}
		
		function processFile(file) {
			var numStringsFound = 0;
	
			console.log('  Processing ' + file);
	
			function processCall(node, next) {
				if (node[1][0] === 'name' && (node[1][1] === '__' || node[1][1] === '__n')) {
					if (node[2][0][0].name !== 'string') {
						console.warn('**** Non-string found in i18n call ****');
					}
					numStringsFound++;
					if (node[1][1] === '__') {
						masterList[node[2][0][1]] = node[2][0][1];
					} else {
						if (node[2][1][0].name !== 'string') {
							console.warn('**** Non-string found in i18n call ****');
						}
						masterList[node[2][0][1]] = {
							one: node[2][0][1],
							other: node[2][1][1]
						};
					}
				}
				next();
			}
	
			if (!astWalker(file, { call: processCall })) {
				console.log('**** Could not process ' + file + ' ****');
			} else {
				if (numStringsFound) {
					console.log('    ' + numStringsFound + ' i18n strings found');
				}
			}
		}

		// Write the en locale file
		console.log('  Creating en locale file ' + path.join(localesDir, 'en.js') + '\n');
		if (!fs.existsSync(localesDir)) {
			wrench.mkdirSyncRecursive(localesDir);
		}
		fs.writeFileSync(path.join(localesDir, 'en.js'), JSON.stringify(masterList, false, '\t'));
	});
	
	console.log('Projects analyzed successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
}