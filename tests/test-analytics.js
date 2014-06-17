/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index'),
	http = require('http'),
	temp = require('temp');

describe('analytics', function () {
	it('namespace exists', function () {
		appc.should.have.property('analytics');
		appc.analytics.should.be.a('object');
	});

	describe('#addEvent()', function () {
		it('should add an analytics event to queue', function () {
			var length = appc.analytics.events.length;
			appc.analytics.addEvent('dummy unit test event', { dummy: 'data' }, 'unit.test');
			(appc.analytics.events.length).should.equal(length + 1);
			appc.analytics.events = [];
		});
	});

	describe('#send()', function () {
		it('should fail to send because missing arguments', function (done) {
			this.timeout(10000);
			this.slow(5000);

			appc.analytics.events = [];

			var server = http.createServer(function (req, res) {
					res.writeHead(200, {'Content-Type': 'text/plain'});
					res.end('Hello World\n');
					cleanup(new Error('analytics sent despite missing arguments'));
				});

			server.listen(1337, '127.0.0.1');

			var childRunning = true,
				successTimer = setTimeout(function () {
					cleanup();
				}, 5000),
				child = appc.analytics.send({
					analyticsUrl: 'http://127.0.0.1:1337'
				});

			function cleanup(err) {
				clearTimeout(successTimer);
				if (childRunning) {
					childRunning = false;
					child.kill();
				}
				server && server.close(function () {
					server = null;
					done(err);
				});
			}

			// check if the child exited abnormally
			child.on('exit', function (code) {
				childRunning = false;
				code && cleanup();
			});
		});

		it('should post ti.start event', function (done) {
			this.timeout(10000);
			this.slow(5000);

			appc.analytics.events = [];

			var tempDir = temp.mkdirSync(),
				server = http.createServer(function (req, res) {
console.log('got connection!');
					if (req.method != 'POST') return cleanup(new Error('expected POST, got ' + req.method));

					var body = '';
					req.on('data', function (chunk) {
						body += chunk.toString();
					});

					req.on('end', function () {
						// verify the body is good
						var b = {};
						body.split(/&(?!amp;)/).map(function (i) {
							return decodeURIComponent(i);
						}).forEach(function (entry) {
							var p = entry.indexOf('=');
							b[entry.substring(0, p)] = entry.substring(p + 1);
						});

						if (!b.type) return cleanup(new Error('analytics event missing type'));
						if (b.type != 'ti.start') return cleanup(new Error('analytics event wrong type; got ' + b.type + ', expected ti.start'));

						res.writeHead(204);
						res.end();
						setTimeout(cleanup, 100);
					});
				});

			server.listen(1337, '127.0.0.1');

			var childRunning = true,
				successTimer = setTimeout(function () {
					cleanup(new Error('analytics timed out'));
				}, 8000),
				child = appc.analytics.send({
					analyticsUrl: 'http://127.0.0.1:1337',
					appId: 'com.appcelerator.node-appc.unit-tests.test-analytics',
					appName: 'Analytics Unit Test',
					appGuid: '12345678_1234_1234_123456789012',
					directory: tempDir,
					version: '1.0.0'
				});

			function cleanup(err) {
				clearTimeout(successTimer);
				if (childRunning) {
					childRunning = false;
					child.kill();
				}
				server && server.close(function () {
					server = null;
					done(err);
				});
			}
		});

		// TODO: test sending multiple events
		// TODO: simulate send while logged out
		// TODO: simulate send while logged in
	});
});