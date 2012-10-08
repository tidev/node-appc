#!/usr/bin/env node

var path = require('path'),
	fs = require('fs'),
	util = require('util'),
	uglify = require('uglify-js'),
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

	console.log('Processing ' + file);
	
	var ast,
		i18n = [],
		nodeStack = [],
		node,
		name,
		i, len,
		nodesProcessed = 0,
		stringsFound = 0;
	
	try {
		ast = uglify.parser.parse(fs.readFileSync(file).toString(), false, true);
	} catch (e) {
		console.error('Source file ' + file + ' could not be parsed: ' + e.message);
		return;
	}
	
	// Append one or more AST nodes
	function appendNode() {
		for(var i = 0, len = arguments.length; i < len; i++) {
			if (Array.isArray(arguments[i])) {
				nodeStack.push(arguments[i]);
			}
		}
	}
	
	// Append one ore more arrays of AST nodes
	function appendNodeSet() {
		for(var i = 0, len = arguments.length; i < len; i++) {
			if (Array.isArray(arguments[i])) {
				for(var j = 0; j < arguments[i].length; j++) {
					if (Array.isArray(arguments[i][j])) {
						nodeStack.push(arguments[i][j]);
					}
				}
			}
		}
	}
	
	appendNode(ast);
	
	// "Recursively" find all declarations
	while (nodeStack.length) {
		nodesProcessed++;
		node = nodeStack.pop();
		name = typeof node[0] === 'string' ? node[0] : node[0].name;
		
		// TODO: Check if this is a call rull
		if (name === 'call' && node[1][0] === 'name') {
			if (node[1][1] === '__' || node[1][1] === '__n') {
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
		
		// Each node is a little different when it comes to children, so we have to handle them on a case-by-case basis
		switch (name) {
			case 'array':
				appendNodeSet(node[1]);
				break;
			case 'assign':
				appendNode(node[2], node[3]);
				break;
			case 'atom':
				break;
			case 'binary':
				appendNode(node[2], node[3]);
				break;
			case 'block':
				appendNodeSet(node[1]);
				break;
			case 'break':
				break;
			case 'call':
				appendNode(node[1]);
				appendNodeSet(node[2]);
				break;
			case 'conditional':
				appendNode(node[1], node[2], node[3]);
				break;
			case 'continue':
				break;
			case 'debugger':
				break;
			case 'defun':
				appendNodeSet(node[3]);
				break;
			case 'directive':
				break;
			case 'do':
				appendNode(node[1], node[2]);
				break;
			case 'dot':
				appendNode(node[1], node[2]);
				break;
			case 'for-in':
				appendNode(node[1], node[2], node[3], node[4]);
				break;
			case 'for':
				appendNode(node[1], node[2], node[3], node[4]);
				break;
			case 'function':
				appendNodeSet(node[3]);
				break;
			case 'if':
				appendNode(node[1], node[2], node[3]);
				break;
			case 'label':
				appendNode(node[2]);
				break;
			case 'name':
				break;
			case 'new':
				appendNode(node[1]);
				appendNodeSet(node[2]);
				break;
			case 'num':
				break;
			case 'object':
				node[1].forEach(function(prop) {
					appendNode(prop[1]);
				});
				break;
			case 'regexp':
				break;
			case 'return':
				appendNode(node[1]);
				break;
			case 'seq':
				appendNode(node[1], node[2]);
				break;
			case 'stat':
				appendNode(node[1]);
				break;
			case 'string':
				break;
			case 'sub':
				appendNode(node[1], node[2]);
				break;
			case 'switch':
				appendNode(node[1]);
				node[2].forEach(function(switchCase) {
					appendNode(switchCase[0]);
					appendNodeSet(switchCase[1]);
				});
				break;
			case 'throw':
				appendNode(node[1]);
				break;
			case 'toplevel':
				appendNodeSet(node[1]);
				break;
			case 'try':
				appendNodeSet(node[1]);
				node[2] && appendNodeSet(node[2][1]);
				appendNodeSet(node[3]);
				break;
			case 'unary-postfix':
				appendNode(node[2]);
				break;
			case 'unary-prefix':
				appendNode(node[2]);
				break;
			case 'var':
				node[1].forEach(function(init) {
					appendNode(init[1]);
				});
				break;
			case 'while':
				appendNode(node[1], node[2]);
				break;
			case 'with':
				appendNode(node[1], node[2]);
				break;
			default:
				console.log(util.inspect(node, false, 3));
				console.error('Internal error: unknown node ' + name);
				process.exit(1);
				break;
		}
	}
	stringsFound && console.log(stringsFound + ' i18n strings found');
	console.log(nodesProcessed + ' nodes processed\n');
}

// Write the en locale file
console.log('Creating en locale file\n');
localesDir = localesDir ? path.resolve(localesDir) : path.join(sourceDir, 'locales');
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