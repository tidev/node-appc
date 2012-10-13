#!/usr/bin/env node

var fs = require('fs'),
	path = require('path'),

	request = require('request'),
	async = require('async'),
	wrench = require('wrench'),
	
	progress = require('../../lib/progress'),
	
	configFile = path.join(process.env[process.platform == 'win32' ? 'USERPROFILE' : 'HOME'], '.titanium', 'i18n-sync.json'),
	config,
	
	wtiPrefix = 'https://webtranslateit.com/api/projects/',
	
	requestInfoTasks = [],
	startTime = Date.now(),
	
	translations = {},
	transferAmount = 0,
	
	command = process.argv[2],
	project = process.argv[3],
	
	startTime = Date.now();

// Load the config file
console.log();
try {
	config = JSON.parse(fs.readFileSync(configFile));
} catch(e) {
	console.error('Error reading the config file');
	console.error(e.message);
	process.exit(1);
}
switch(command) {
	case 'push':
		validateProject();
		push();
		break;
	case 'pull':
		validateProject();
		pull();
		break;
	case 'analyze':
		validateProject();
		analyze();
		break;
	case 'help':
	case '--help':
		printUsage();
		break;
	default:
		if (command) {
			console.error('Invalid command: ' + command);
		} else {
			console.error('Missing command');
		}
		printUsage();
		process.exit();
		break;
}

function printUsage() {
	console.log('Usage: i18n-sync <push | pull | analyze> <project name>\n');
}

function validateProject() {
	if (project in config) {
		config = config[project];
		for(var p in config.projects) {
			if (!fs.existsSync(config.projects[p])) {
				console.error('Could not locate project ' + p + ': ' + config.projects[p] + ' does not exist\n');
				process.exit(1);
			}
		}
		
	} else {
		if (project) {
			console.error('Invalid project specified: ' + project);
		} else {
			console.error('Missing project');
		}
		printUsage();
		process.exit(1);
	}
}

function push() {
	var masterList = {},
		requestInfoTasks = [],
		transferAmount = 0;
	
	console.log('Generating master language file for remote');
	Object.keys(config.projects).forEach(function (projectName) {
		var localeFilePath = path.join(config.projects[projectName], 'locales', 'en.js'),
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
	
	/*console.log('Fetching remote project information');
	request(wtiPrefix + config.privateKey + '.json', function (error, response, body) {
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
							uri: wtiPrefix + config.privateKey + '/files/' + masterFileId + '/locales/en',
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

function pull() {
	var locales = [],
		strings = [];

	console.log('Fetching remote project information');
	async.parallel([
			
		// Get the list of locales
		function (next) {
			request(wtiPrefix + config.privateKey + '.json', function (error, response, body) {
				body && (transferAmount += body.length);
				if (error) {
					next('Could not fetch the information for ' + project + ': ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the information for ' + project + ': server returned ' + 
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the information for ' + project + ': server returned ' + response.statusCode + '\n');
					}
				} else {
					body = JSON.parse(body);
					if (body.error) {
						next('Could not fetch the information for ' + project + ': ' + body.error);
					}
					if (body.project && body.project.target_locales) {
						body.project.target_locales.forEach(function(locale) {
							locales.push(locale.code);
						});
						next();
					} else {
						next('Could not fetch the information for ' + project + ': invalid server response');
					}
				}
			});
		},
			
		// Get the list of strings
		function (next) {
			request(wtiPrefix + config.privateKey + '/strings', function (error, response, body) {
				body && (transferAmount += body.length);
				if (error) {
					next('Could not fetch the strings for ' + project + ': ' + error);
				} else if (response.statusCode !== 200) {
					try {
						next('Could not fetch the information for ' + project + ': server returned ' + 
							response.statusCode + ': ' + JSON.parse(body).error + '\n');
					} catch(e) {
						next('Could not fetch the information for ' + project + ': server returned ' + response.statusCode + '\n');
					}
				} else {
					body = JSON.parse(body);
					if (body.error) {
						next('Could not fetch the information for ' + project + ': ' + body.error);
					}
					body.forEach(function (str) {
						strings.push(str.id);
					});
					next();
				}
			});
		}
	], function(err, result) {
		if (err) {
			console.error(err);
			process.exit(1);
		} else {
			var numRequests = locales.length * strings.length,
				p,
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
							request(wtiPrefix + config.privateKey + '/strings/' + str + '/locales/' + locale + '/translations.json', function (error, response, body) {
								body && (transferAmount += body.length);
								var strings = [];
								if (error) {
									strNext('Could not fetch the strings for ' + name + ': ' + error);
								} else if (response.statusCode !== 200) {
									try {
										strNext('Could not fetch the information for ' + name + ': server returned ' + 
											response.statusCode + ': ' + JSON.parse(body).error + '\n');
									} catch(e) {
										strNext('Could not fetch the information for ' + name + ': server returned ' + response.statusCode + '\n');
									}
								} else {
									body = JSON.parse(body);
									if (body.error) {
										next('Could not fetch the information for ' + project + ': ' + body.error);
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
			async.parallel(localeTasks, function(err, result) {
				
				if (err) {
					console.error(err);
					process.exit(1);
				} else {
					var projectTasks = [],
						numLocalesAssembled = 0;
					
					console.log('\n  ' + (transferAmount / 1000).toFixed(0) + ' kb transferred in ' + 
						((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\nAssembling local locale files');
					Object.keys(config.projects).forEach(function (projectName) {
						projectTasks.push(function(projectNext) {
							var masterLocaleFilePath = path.join(config.projects[projectName], 'locales', 'en.js'),
								masterLocale,
								locale,
								str,
								targetLocale,
								targetLocaleFilePath;
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
									fs.writeFileSync(path.join(config.projects[projectName], 'locales', locale + '.js'), 
										JSON.stringify(targetLocale, false, '\t'));
									numLocalesAssembled++;
								}
								projectNext();
							});
						});
					});
				
					async.parallel(projectTasks, function(err, result) {
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
		dirWhiteList = /^(lib|plugins|commands|hooks)/,
		nodeModulesRegex = /node_modules/;
	
	Object.keys(config.projects).forEach(function (projectName) {
		var masterList = {},
			files,
			file,
	
			i = 0, len,
	
			locales,
			locale,
			localePath,
			localeName,
			
			sourceDir = config.projects[projectName],
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
	
			function processCall(node) {
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
						}
					}
				}
			}
	
			if (!astWalker(file, { call: processCall })) {
				console.log('**** Could not process ' + file + ' ****');
			} else {
				numStringsFound && console.log('    ' + numStringsFound + ' i18n strings found');
			}
		}

		// Write the en locale file
		console.log('\n  Creating en locale file ' + path.join(localesDir, 'en.js') + '\n');
		if (!fs.existsSync(localesDir)) {
			wrench.mkdirSyncRecursive(localesDir);
		}
		fs.writeFileSync(path.join(localesDir, 'en.js'), JSON.stringify(masterList, false, '\t'));
	});
	
	console.log('Projects analyzed successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
}