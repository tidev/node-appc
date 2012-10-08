/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 *
 * Portions derived from prompt under the MIT license.
 * Copyright (c) 2010 Nodejitsu Inc.
 * https://github.com/flatiron/prompt
 */

var async = require('async');

module.exports = function (schema, callback) {
	if (process.platform !== 'win32') {
		// windows falls apart trying to deal with SIGINT
		process.on('SIGINT', function () {
			stdout.write('\n');
			process.exit(1);
		});
	}
	
	iterate(schema, function get(target, next) {
		console.log('getting input for ', target);
		next();
		/*
		prompt.getInput(target, function (err, line) {
			return err ? next(err) : next(null, line);
		});
		*/
	}, callback);
};

function untangle(schema, path) {
	var results = [];
	path = path || [];
	
	if (schema.properties) {
		// Iterate over the properties in the schema and use recursion
		// to process sub-properties.
		Object.keys(schema.properties).forEach(function (key) {
			var obj = {};
			obj[key] = schema.properties[key];
			
			// Concat a sub-untangling to the results.
			results = results.concat(untangle(obj[key], path.concat(key)));
		});
		
		// Return the results.
		return results;
	}
	
	// This is a schema "leaf".
	return {
		path: path,
		schema: schema
	};
}

function iterate(schema, get, done) {
	var iterator = untangle(schema),
		result = {};
	
	// Now, iterate and assemble the result.
	async.forEachSeries(iterator, function (branch, next) {
		get(branch, function assembler(err, line) {
			if (err) {
				return next(err);
			}
	
			function build(path, line) {
				var obj = {};
				if (path.length) {
					obj[path[0]] = build(path.slice(1), line);
					return obj;
				}
				return line;
			}
			
			function attach(obj, attr) {
				if (typeof attr !== 'object') {
					return attr;
				}
				
				var keys = Object.keys(attr);
				if (keys.length) {
					if (!obj[keys[0]]) {
						obj[keys[0]] = {};
					}
					obj[keys[0]] = attach(obj[keys[0]], attr[keys[0]]);
				}
				
				return obj;
			}
			
			result = attach(result, build(branch.path, line));
			next();
		});
	}, function (err) {
		return err ? done(err) : done(null, result);
	});
}