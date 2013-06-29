/**
 * Generates API docs in both markdown and html.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

module.exports = function () {
	var spawn = require('child_process').spawn,
		async = require('async'),
		wrench = require('wrench'),
		startTime = Date.now();

	spawn('which', [ 'jsdoc' ]).on('exit', function (code) {
		if (code) {
			console.error('ERROR: Unable to find "jsdoc".\n\n'
				+ 'Please install it by running "npm install -g jsdoc".\n');
			process.exit(1);
		} else {
			var docsdir = path.join(rootDir, 'docs'),
				libdir = path.join(rootDir, 'lib'),
				jsdox = require("jsdox"),
				jsfile = /\.js$/,
				ignore = /^[\.|_]/;

			wrench.rmdirSyncRecursive(docsdir, true);
			wrench.mkdirSyncRecursive(docsdir);

			async.series(wrench.readdirSyncRecursive(libdir).map(function (file) {
				return function (cb) {
					if (jsfile.test(file) && !ignore.test(file)) {
						var src = path.join(libdir, file),
							dest = path.join(docsdir, path.dirname(file));
						fs.existsSync(dest) || wrench.mkdirSyncRecursive(dest);
						console.log(src, '=>', path.join(dest, file.replace(jsfile, '.md')));
						jsdox.generateForDir(src, dest, function () {
							cb();
						});
					} else {
						cb();
					}
				};
			}), function () {
				console.log('Docs generated successfully in ' + ((Date.now() - startTime) / 1000).toFixed(1) + ' seconds\n');
			});

			/*
			var apidox = require('apidox'),
				jsfile = /\.js$/,
				ignore = /^[\.|_]/;

			wrench.mkdirSyncRecursive(docsdir);

			wrench.readdirSyncRecursive(libdir).forEach(function (n) {
				if (jsfile.test(n) && !ignore.test(n)) {
					var src = path.join(libdir, n),
						dest = path.join(docsdir, n.replace(jsfile, '.md'));
					fs.existsSync(path.dirname(dest)) || wrench.mkdirSyncRecursive(path.dirname(dest));
					fs.writeFileSync(path.join(docsdir, n.replace(jsfile, '.md')), apidox.create()
						.set('input', src)
						.parse()
						.convert());
				}
			});
			*/

			/*
			var child = spawn('jsdoc', [ '-c', path.join('tools', 'docs', 'conf.json') ], params),
				out = '',
				outFn = function (data) { out += data.toString(); };

			child.stdout.on('data', outFn);
			child.stderr.on('data', outFn);

			child.on('exit', function (code) {
				if (code) {
					console.error('Error building docs:\n' + out + '\n');
				} else {
					console.log('Docs generated successfully in ' + (Math.round((Date.now() - startTime) / 100) / 10) + ' seconds\n');
				}
			});
			*/
			//console.log('Docs generated successfully in ' + (Math.round((Date.now() - startTime) / 100) / 10) + ' seconds\n');
		}
	});
};