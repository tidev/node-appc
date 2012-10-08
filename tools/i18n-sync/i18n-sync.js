#!/usr/bin/env node

var fs = require('fs'),
	path = require('path'),

	request = require('request'),
	async = require('async'),
	wrench = require('wrench'),
	
	progress = require('../../lib/progress'),
	
	configFile = 'config.json',
	config,
	
	wtiPrefix = 'https://webtranslateit.com/api/projects/',
	
	requestInfoTasks = [],
	startTime = Date.now(),
	
	translations = {},
	transferAmount = 0;

// Create the sync tasks
try {
	config = JSON.parse(fs.readFileSync(configFile));
} catch(e) {
	console.error('Error reading the config file');
	console.error(e.message);
}
console.log()
config.forEach(function (configEntry) {
	console.log('Processing project ' + configEntry.name);
	requestInfoTasks.push(function (projectNext) {
		var name = configEntry.name,
			privateKey = configEntry.privateKey,
			location = configEntry.location;
		translations[name] = {
			privateKey: privateKey,
			location: location,
			translations: {}
		};
		async.parallel([
			
			// Get the list of locales
			function (next) {
				request(wtiPrefix + privateKey + '.json', function (error, response, body) {
					var locales = [];
					body && (transferAmount += body.length);
					if (error) {
						next('Could not fetch the information for ' + name + ': ' + error);
					} else if (response.statusCode !== 200) {
						next('Could not fetch the information for ' + name + ': server returned ' + response.statusCode);
					} else {
						body = JSON.parse(body);
						if (body.project && body.project.target_locales) {
							body.project.target_locales.forEach(function(locale) {
								translations[name].translations[locale.code] = {};
								locales.push(locale.code);
							});
							translations[name].locales = locales;
							next();
						} else {
							next('Could not fetch the information for ' + name + ': invalid server response');
						}
					}
				});
			},
			
			// Get the list of strings
			function (next) {
				request(wtiPrefix + privateKey + '/strings', function (error, response, body) {
					var strings = [];
					body && (transferAmount += body.length);
					if (error) {
						next('Could not fetch the strings for ' + name + ': ' + error);
					} else if (response.statusCode !== 200) {
						next('Could not fetch the strings for ' + name + ': server returned ' + response.statusCode);
					} else {
						body = JSON.parse(body);
						body.forEach(function (str) {
							strings.push(str.id);
						});
						translations[name].strings = strings;
						next();
					}
				});
			}
		], function(err, result) {
			projectNext(err);
		});
	});
});
console.log('\nFetching project information');
async.parallel(requestInfoTasks, function(err, result) {

	console.log('Fetching internationalization information');
	var numRequests = 0,
		p,
		projectTasks = [],
		pb;
	Object.keys(translations).forEach(function (name) {
		var translation = translations[name],
			privateKey = translation.privateKey,
			location = translation.location;
		numRequests += translation.locales.length * translation.strings.length;
		projectTasks.push(function (projectNext) {
			var localeTasks = [];
			translation.locales.forEach(function (locale) {
				localeTasks.push(function (localeNext) {
					var stringTasks = [];
					translation.strings.forEach(function (str) {
						stringTasks.push(function (strNext) {
							request(wtiPrefix + privateKey + '/strings/' + str + '/locales/' + locale + '/translations.json', function (error, response, body) {
								body && (transferAmount += body.length);
								var strings = [];
								if (error) {
									strNext('Could not fetch the strings for ' + name + ': ' + error);
								} else if (response.statusCode !== 200) {
									strNext('Could not fetch the strings for ' + name + ': server returned ' + response.statusCode);
								} else {
									body = JSON.parse(body);
									if (body.text) {
										translation.translations[locale][body.string.key] = body.text;
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
				projectNext(err);
			});
		});
	});
	pb = new progress(':paddedPercent [:bar] :etas', {
		complete: '=',
		incomplete: '.',
		width: 65,
		total: numRequests
	});
	pb.tick();
	async.parallel(projectTasks, function(err, result) {
		console.log('\n' + (transferAmount / 1000).toFixed(0) + ' kb transferred\n');
		if (err) {
			console.log(err);
		} else {
			projectTasks = [];
			Object.keys(translations).forEach(function(name) {
				var translation = translations[name],
					location = translation.location;
				projectTasks.push(function(projectNext) {
					var writeTasks = [];
					translation.locales.forEach(function (locale) {
						writeTasks.push(function(writeNext) {
							if (locale !== 'en' && Object.keys(translation.translations[locale]).length) {
								var localeFile = path.join(location, 'locales');
								if (!fs.existsSync(localeFile)) {
									wrench.mkdirSyncRecursive(localeFile);
								}
								localeFile = path.join(localeFile, locale + '.js');
								console.log('Writing locale file ' + localeFile);
								fs.writeFile(localeFile, JSON.stringify(translations[locale], false, '\t'), function(err) {
									if (err) {
										console.log('Error writing locale file ' + localeFile + ': ' + err);
									}
									writeNext(err);
								});
							} else {
								writeNext();
							}
						});
					});
					async.parallel(writeTasks, function(err, result) {
						projectNext(err);
					});
				});
			});
			async.parallel(projectTasks, function(err, result) {
				console.log('\nSyncing completed ' + (err ? 'with errors' : 'successfully') + ' in ' + ((Date.now() - startTime) / 1000) + 's\n');
			});
		}
	});
});