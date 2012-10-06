#!/usr/bin/env node

var path = require('path'),
	fs = require('fs'),
	util = require('util'),
	uglify = require('uglify-js'),
	wrench = require('wrench'),
	sourceDir = process.argv[2],
	destinationFile = process.argv[3] || 'i18nStrings.json',
	jsExtensionRegex = /\.js$/,
	startTime = Date.now(),
	i18nStrings = [],
	i18nPluralStrings = [];

if (!sourceDir) {
	console.log('Usage: i18n-analyzer.js <source-dir> [<destination-file>]\n');
	process.exit(1);
}

if (!fs.existsSync(sourceDir) || !fs.lstatSync(sourceDir).isDirectory()) {
	console.log('"' + sourceDir + '" does not exist or is not a directory\n');
	process.exit(1);
}

var files = wrench.readdirSyncRecursive(sourceDir),
	file,
	i = 0,
	len = files.length;
for(; i < len; i++) {
	file = path.resolve(path.join(sourceDir, files[i]));
	if (jsExtensionRegex.test(file)) {
		processFile(file);
	}
}

function processFile(file) {
	var ast = uglify.parser.parse(fs.readFileSync(file).toString(), false, true),
		i18n = [],
		nodeStack = [],
		node,
		name,
		i, len,
		nodesProcessed = 0,
		stringsFound = 0;

	console.log('Processing ' + file);
	
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
					i18nStrings.push(node[2][0][1]);
				} else {
					i18nPluralStrings.push(node[2][0][1]);
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

fs.writeFileSync(destinationFile, JSON.stringify({
	__: i18nStrings,
	__n: i18nPluralStrings
}, false, '\t'));


console.log('Analysis completed in ' + ((Date.now() - startTime) / 1000) + 's\n');