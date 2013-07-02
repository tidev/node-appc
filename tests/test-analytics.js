var assert = require("assert"),
	http = require('http'),
	temp = require('temp'),
	wrench = require('wrench'),
	analytics = require('../index').analytics,
	getType = function (it) {
		return Object.prototype.toString.call(it).replace(/^\[object (.+)\]$/, '$1');
	};

describe('analytics', function () {
	it('namespace exists', function () {
		assert(!!require('../index').analytics, 'analytics namespace does not exist');
	});

	describe('#addEvent()', function () {
		it('should add an analytics event to queue', function () {
			var length = analytics.events.length;
			analytics.addEvent('dummy unit test event', { dummy: 'data' }, 'unit.test');
			(analytics.events.length).should.equal(length + 1);
			analytics.events = [];
		});
	});

	describe('#send()', function () {
		it('should fail to send because missing arguments', function (done) {
			this.timeout(3000);
			this.slow(3000);

			analytics.events = [];

			var server = http.createServer(function (req, res) {
					res.writeHead(200, {'Content-Type': 'text/plain'});
					res.end('Hello World\n');
					cleanup(new Error('analytics sent despite missing arguments'));
				}).listen(1337, '127.0.0.1'),
				child = analytics.send({
					analyticsUrl: 'http://127.0.0.1:1337'
				}),
				childRunning = true,
				successTimer = setTimeout(function () {
					cleanup();
				}, 1000);

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
			this.timeout(3000);
			this.slow(3000);

			analytics.events = [];

			var tempDir = temp.path(),
				server = http.createServer(function (req, res) {
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
						cleanup();
					});
				}).listen(1337, '127.0.0.1'),
				child = analytics.send({
					analyticsUrl: 'http://127.0.0.1:1337',
					appId: 'com.appcelerator.node-appc.unit-tests.test-analytics',
					appName: 'Analytics Unit Test',
					appGuid: '12345678_1234_1234_123456789012',
					directory: tempDir,
					version: '1.0.0'
				}),
				childRunning = true,
				successTimer = setTimeout(function () {
					cleanup(new Error('analytics timed out'));
				}, 2000);

			function cleanup(err) {
				clearTimeout(successTimer);
				if (childRunning) {
					childRunning = false;
					child.kill();
				}
				wrench.rmdirSyncRecursive(tempDir);
				server && server.close(function () {
					server = null;
					done(err);
				});
			}
		});

		// test sending multiple events
		// simulate logout
		// simulate login
	});
});