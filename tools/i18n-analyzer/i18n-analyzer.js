#!/usr/bin/env node

var path = require('path'),
	fs = require('fs'),
	util = require('util'),
	astWalker = require('../../lib/ast-walker'),
	wrench = require('wrench'),
	
	sourceDir = process.argv[2],
	localesDir = process.argv[3],
	
	jsExtensionRegex = /\.js$/,
	localeDirRegex = /^locales$/,
	nodeModulesRegex = /node_modules/,
	
	startTime = Date.now(),
	
	en = {},
	files,
	file,
	
	i = 0, len,
	
	locales,
	locale,
	localePath,
	localeName;

if (!sourceDir) {
	console.log('Usage: i18n-analyzer.js <source-dir> <locales-dir>]\n');
	process.exit(1);
}

if (!fs.existsSync(sourceDir) || !fs.lstatSync(sourceDir).isDirectory()) {
	console.log('"' + sourceDir + '" does not exist or is not a directory\n');
	process.exit(1);
}
sourceDir = path.resolve(sourceDir);

// Process the source files
files = wrench.readdirSyncRecursive(sourceDir);
len = files.length;
for(; i < len; i++) {
	file = path.join(sourceDir, files[i]);
	if (jsExtensionRegex.test(file) && !localeDirRegex.test(path.dirname(files[i])) && !nodeModulesRegex.test(files[i])) {
		processFile(file);
	}
}

function processFile(file) {
	var stringsFound = 0;
	
	console.log('Processing ' + file);
	
	function processCall(node) {
		if (node[1][0] === 'name' && (node[1][1] === '__' || node[1][1] === '__n')) {
			if (node[2][0][0].name !== 'string') {
				console.warn('Non-string found in i18n call');
			}
			stringsFound++;
			if (node[1][1] === '__') {
				en[node[2][0][1]] = node[2][0][1];
			} else {
				if (node[2][1][0].name !== 'string') {
					console.warn('Non-string found in i18n call');
				}
				en[node[2][0][1]] = {
					one: node[2][0][1],
					other: node[2][1][1]
				}
			}
		}
	}
	
	if (!astWalker(file, { call: processCall })) {
		console.log('**** Could not process ' + file + ' ****');
	} else {
		stringsFound && console.log('  ' + stringsFound + ' i18n strings found');
	}
}

// Write the en locale file
localesDir = localesDir ? path.resolve(localesDir) : path.join(sourceDir, 'locales');
console.log('\nCreating en locale file at ' + path.join(localesDir, 'en.js') + '\n');
if (!fs.existsSync(localesDir)) {
	wrench.mkdirSyncRecursive(localesDir);
}
fs.writeFileSync(path.join(localesDir, 'en.js'), JSON.stringify(en, false, '\t'));

// Validate the other locales, if any exist
locales = wrench.readdirSyncRecursive(localesDir);
for(i = 0, len = locales.length; i < len; i++) {
	localeName = locales[i].replace('.js', '');
	if (localeName !== 'en') {
		
		console.log('Validating local ' + localeName);
		
		localePath = path.join(localesDir, localeName + '.js');
		try {
			locale = JSON.parse(fs.readFileSync(localePath));
		} catch (e) {
			console.error('Locale file ' + localePath + ' is not valid');
			continue;
		}
		
		// Remove unused entries
		Object.keys(locale).forEach(function(entry) {
			if (!en[entry]) {
				delete locale[entry];
				console.log('Removing unused entry "' + entry + '"');
			}
		});
		
		// Make sure all used entries are present
		Object.keys(en).forEach(function(entry) {
			if (!locale[entry]) {
				console.error('**** Locale ' + localeName + ' is missing entry "' + entry + '" ****');
			}
		});
		
		fs.writeFileSync(path.join(localesDir, localeName + '.js'), JSON.stringify(locale, true, '\t'));
		console.log();
	}
}

console.log('Analysis completed in ' + ((Date.now() - startTime) / 1000) + 's\n');