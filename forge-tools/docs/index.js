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
		fs = require('fs-extra'),
		colors = require('colors'),
		startTime = Date.now();

	console.log('Documentation Tool'.cyan.bold + ' - Copyright (c) 2012-' + (new Date).getFullYear() + ', Appcelerator, Inc.  All Rights Reserved.\n');

	spawn('which', [ 'jsdoc' ]).on('exit', function (code) {
		if (code) {
			console.error('ERROR: Unable to find "jsdoc".\n\n'.red
				+ 'Please install it by running "npm install -g jsdoc".\n');
			process.exit(1);
		} else {
			var docsdir = path.join(rootDir, 'docs'),
				libdir = path.join(rootDir, 'lib'),
				jsdox = require("jsdox"),
				jsfile = /\.js$/,
				ignore = /^[\.|_]/;

			fs.removeSync(docsdir, true);
			fs.removeSync(docsdir);

			async.series(fs.readdirSync(libdir).map(function (file) {
				return function (cb) {
					if (jsfile.test(file) && !ignore.test(file)) {
						var src = path.join(libdir, file),
							dest = path.join(docsdir, path.dirname(file));
						fs.ensureDirSync(dest);
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

			fs.mkdirsSync(docsdir);

			fs.readdirSync(libdir).forEach(function (n) {
				if (jsfile.test(n) && !ignore.test(n)) {
					var src = path.join(libdir, n),
						dest = path.join(docsdir, n.replace(jsfile, '.md'));
					fs.ensureDirSync(path.dirname(dest));
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
