/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var uglify = require('uglify-js'),
	fs = require('fs');

/**
 * Walk an AST, recieving callbacks for desired nodes.
 *
 * @method
 * @param {String|module:AST.node} filename The file to process or a pre-parsed AST tree
 * @param {Object[Function({@link module:AST.node}, Function)]} eventListeners An object containing the rules to listen
 *		for ('*' for all). Each key is the name of the rule to listen for and the value is the function to call. Each
 *		callback function takes two parameters: the AST node and a 'next' function. Calling this function will cause the
 *		children of the node to be processed. Not calling the 'next' function will cause the children to be skipped.
 * @returns {Boolean} Indicates if the file was processed correctly
 */
module.exports = function (astOrFilename, eventListeners) {
	
	var ast;
	
	// Create the AST and add it to the stack
	try {
		if (Object.prototype.toString.call(astOrFilename) == '[object String]') {
			ast = uglify.parser.parse(fs.readFileSync(astOrFilename).toString(), false, true);
		} else {
			ast = astOrFilename;
		}
	} catch (e) {
		return false;
	}
	
	function walkNode(node) {
		if (!node) {
			return;
		}

		var name = typeof node[0] === 'string' ? node[0] : node[0].name,
			handler = eventListeners[name] || eventListeners['*'];

		function processChildren() {
			var i, len;
			function processNodeSet(nodeSet) {
				if (!nodeSet) {
					return;
				}
				for(i = 0, len = nodeSet.length; i < len; i++) {
					walkNode(nodeSet[i]);
				}
			}

			// Each node is a little different when it comes to children, so we have to handle them on a case-by-case basis
			switch (name) {
				case 'array':
					processNodeSet(node[1]);
					break;
				case 'assign':
					walkNode(node[2]);
					walkNode(node[3]);
					break;
				case 'atom':
					return;
				case 'binary':
					walkNode(node[2]);
					walkNode(node[3]);
					break;
				case 'block':
					processNodeSet(node[1]);
					break;
				case 'break':
					break;
				case 'call':
					walkNode(node[1]);
					processNodeSet(node[2]);
					break;
				case 'conditional':
					walkNode(node[1]);
					walkNode(node[2]);
					walkNode(node[3]);
					break;
				case 'const':
					node[1].forEach(function(init) {
						if (init[1]) {
							walkNode(init[1]);
						}
					});
					break;
				case 'continue':
					break;
				case 'debugger':
					break;
				case 'defun':
					processNodeSet(node[3]);
					break;
				case 'directive':
					break;
				case 'do':
					walkNode(node[1]);
					walkNode(node[2]);
					break;
				case 'dot':
					walkNode(node[1]);
					if (typeof node[2] !== 'string') {
						walkNode(node[2]);
					}
					break;
				case 'for-in':
					walkNode(node[1]);
					walkNode(node[2]);
					walkNode(node[3]);
					walkNode(node[4]);
					break;
				case 'for':
					walkNode(node[1]);
					walkNode(node[2]);
					walkNode(node[3]);
					walkNode(node[4]);
					break;
				case 'function':
					processNodeSet(node[3]);
					break;
				case 'if':
					walkNode(node[1]);
					walkNode(node[2]);
					walkNode(node[3]);
					break;
				case 'label':
					walkNode(node[2]);
					break;
				case 'name':
					break;
				case 'new':
					walkNode(node[1]);
					processNodeSet(node[2]);
					break;
				case 'num':
					break;
				case 'object':
					node[1].forEach(function(prop) {
						walkNode(prop[1]);
					});
					break;
				case 'regexp':
					break;
				case 'return':
					walkNode(node[1]);
					break;
				case 'seq':
					walkNode(node[1]);
					walkNode(node[2]);
					break;
				case 'stat':
					walkNode(node[1]);
					break;
				case 'string':
					break;
				case 'sub':
					walkNode(node[1]);
					walkNode(node[2]);
					break;
				case 'switch':
					walkNode(node[1]);
					node[2].forEach(function(switchCase) {
						walkNode(switchCase[0]);
						processNodeSet(switchCase[1]);
					});
					break;
				case 'throw':
					walkNode(node[1]);
					break;
				case 'toplevel':
					processNodeSet(node[1]);
					break;
				case 'try':
					processNodeSet(node[1]);
					if (node[2]) {
						processNodeSet(node[2][1]);
					}
					processNodeSet(node[3]);
					break;
				case 'unary-postfix':
					walkNode(node[2]);
					break;
				case 'unary-prefix':
					walkNode(node[2]);
					break;
				case 'var':
					node[1].forEach(function(init) {
						if (init[1]) {
							walkNode(init[1]);
						}
					});
					break;
				case 'while':
					walkNode(node[1], node[2]);
					break;
				case 'with':
					walkNode(node[1], node[2]);
					break;
				default: // This should never execute. If it does, it means it's a bug in this lib
					throw new Error('Internal error: unknown node ' + name);
			}
		}
		
		// Call the event handler, if it exists
		if (handler) {
			handler(node, function(callback) {
				processChildren();
				if (callback) {
					callback();
				}
			});
		} else {
			processChildren();
		}
	}
	walkNode(ast);
	return true;
};