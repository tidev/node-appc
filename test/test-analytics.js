/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
/* eslint no-unused-expressions: "off" */
'use strict';

var appc = require('../index'),
	http = require('http'),
	temp = require('temp');

describe('analytics', function () {

	beforeEach(done => {
		appc.analytics.events.splice(0, appc.analytics.events.length);
		done();
	});

	it('namespace exists', function () {
		appc.should.have.property('analytics');
		appc.analytics.should.be.an.Object;
	});

	describe('#addEvent()', function () {
		it('should add an analytics event to queue', function () {
			var length = appc.analytics.events.length;
			appc.analytics.addEvent('dummy unit test event', { dummy: 'data' }, 'unit.test');
			(appc.analytics.events.length).should.equal(length + 1);
		});
	});

	describe('#send()', function () {

		it('should post ti.start event', function (done) {
			this.timeout(10000);
			this.slow(9000);

			var finished = false,
				tempDir = temp.mkdirSync(),
				server = http.createServer(function (req, res) {
					if (req.method !== 'POST') {
						return cleanup(new Error('expected POST, got ' + req.method));
					}

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

						if (!b.type) {
							return cleanup(new Error('analytics event missing type'));
						}
						if (b.type !== 'ti.start') {
							return cleanup(new Error('analytics event wrong type; got ' + b.type + ', expected ti.start'));
						}

						res.writeHead(204);
						res.end();
						setTimeout(cleanup, 10);
					});
				});

			server.on('error', function (err) {
				cleanup(new Error(err));
			});

			var childRunning = false,
				successTimer,
				child;

			function cleanup(err) {
				if (finished) {
					return;
				}
				finished = true;
				clearTimeout(successTimer);
				if (childRunning) {
					childRunning = false;
					child && child.kill();
				}
				server && server.close(function () {
					server = null;
					done(err);
				});
			}

			server.listen(8000, function () {
				childRunning = true;

				successTimer = setTimeout(function () {
					cleanup(new Error('analytics timed out'));
				}, 8000);

				appc.analytics.send({
					analyticsUrl: 'http://localhost:8000',
					appId: 'com.appcelerator.node-appc.unit-tests.test-analytics',
					appName: 'Analytics Unit Test',
					appGuid: '12345678_1234_1234_123456789012',
					directory: tempDir,
					version: '1.0.0',
					debug: true,
					logger: console
				}, function (err, _child) {
					child = _child;
					// check if the child exited
					_child && _child.on('exit', function (code) {
						childRunning = false;
						if (code) {
							cleanup(new Error('analytics send process exited with ' + code));
						} else if (!finished) {
							cleanup(new Error('analytics sent, but server never received the request'));
						}
					});
				});
			});
		});

		// TODO: test sending multiple events
	});
});
