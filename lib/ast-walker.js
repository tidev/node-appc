/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var uglify = require('uglify-js'),
 	fs = require('fs');

// Event listeners is a dictionary, with the key being the rule name, and the value being the callback
// Returns true if the file was processed successfully, false otherwise
module.exports = function (filename, eventListeners) {
	
	var ast,
		nodeStack = [],
		node,
		name,
		i, len;
	
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

	// Create the AST and add it to the stack
	try {
		ast = uglify.parser.parse(fs.readFileSync(filename).toString(), false, true);
	} catch (e) {
		return false;
	}
	appendNode(ast);
	
	// "Recursively" find all declarations
	while (nodeStack.length) {
		node = nodeStack.pop();
		name = typeof node[0] === 'string' ? node[0] : node[0].name;
		
		// Call the callback, if it exists
		eventListeners[name] && eventListeners[name](node);
		
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
			default: // This should never execute. If it does, it means it's a bug in this lib
				console.log(util.inspect(node, false, 3));
				console.error('Internal error: unknown node ' + name);
				process.exit(1);
				break;
		}
	}
	
	return true;
}