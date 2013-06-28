/**
 * Bootstraps mocha and handles code coverage testing setup.
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var fs = require('fs'),
	path = require('path'),
	should = require('should'),
	Mocha = require(__dirname + '/../node_modules/mocha/lib/mocha.js'),
	Base = require(__dirname + '/../node_modules/mocha/lib/reporters/base'),
	runTest = process.argv.slice(2).shift(),
	mocha = new Mocha,
	reporter = 'spec';

// if we're running coverage testing, then we need to use our custom reporter
if (process.env.APPC_COV) {
	reporter = function (runner) {
		var jade = require('jade'),
			JSONCov = require(__dirname + '/../node_modules/mocha/lib/reporters/json-cov'),
			file = path.join(fs.existsSync(process.env.APPC_COV) ? process.env.APPC_COV : __dirname + '/templates', 'coverage.jade'),
			fn = jade.compile(fs.readFileSync(file), { filename: file }),
			packageJson = require('../package.json'),
			self = this;

		JSONCov.call(this, runner, false);

		runner.on('end', function () {
			process.stdout.write(fn({
				title: packageJson.name + ' Code Coverage',
				version: packageJson.version,
				cov: self.cov,
				coverageClass: function (n) {
					if (n >= 75) return 'high';
					if (n >= 50) return 'medium';
					if (n >= 25) return 'low';
					return 'terrible';
				}
			}));
		});
	};
}

// most of the logic below is the same as what the standalone mocha process does
Error.stackTraceLimit = Infinity;
Base.useColors = process.argv.indexOf('--no-colors') == -1;

mocha.reporter(reporter).ui('bdd').checkLeaks();
mocha.suite.slow('1s');

if (runTest) {
	// running a single test
	mocha.files = [ path.join(__dirname, 'test-' + runTest + '.js') ];
	if (!fs.existsSync(mocha.files[0])) {
		console.error('ERROR: Invalid test "' + runTest + '"\n');
		process.exit(1);
	}
} else {
	// running all tests
	mocha.files = (function walk(dir) {
		var ff = [];
		fs.readdirSync(dir).forEach(function (name) {
			var file = path.join(dir, name);
			if (fs.statSync(file).isDirectory()) {
				ff = ff.concat(walk(file));
			} else if ((runTest && name == runTest) || (!runTest && /^test\-.+\.js$/.test(name))) {
				ff.push(file);
			}
		});
		return ff;
	}(__dirname));
}

// run the tests
mocha.run(function (err) {
	// if doing coverage tests, we don't care about failures
	process.exit(process.env.APPC_COV || !err ? 0 : 1);
});





/*
experimental multi-process stuff...

var cluster = require('cluster'),
	fs = require('fs'),
	path = require('path'),
	should = require('should'),
	Mocha = require(__dirname + '/../node_modules/mocha/lib/mocha.js'),
	mocha = new Mocha,
	Suite = require(__dirname + '/../node_modules/mocha/lib/suite.js'),
	Test = require(__dirname + '/../node_modules/mocha/lib/test.js'),
	Reporter = require(__dirname + '/../node_modules/mocha/lib/reporters/spec'),
	Base = require(__dirname + '/../node_modules/mocha/lib/reporters/base');

// Base.useColors = false;

Error.stackTraceLimit = Infinity;

if (cluster.isMaster) {
	var results = {};

	function createWorker(file) {
		if (file) {
			var w = cluster.fork();
			w.send({ file: file });
			w.on('message', function (msg) {
				if (msg && msg.type == 'describe') {
					// console.log('MASTER - DESCRIBE() ' + msg.title);
					describe(msg.title, function (){});
				} else if (msg && msg.type == 'it') {
					// console.log('MASTER - IT() ' + msg.title);
					it(msg.title, function (done) {
						var r = results[msg.pid + ':' + msg.title];
						if (!r || r.type == 'pass') {
							done();
						} else {
							throw r.error;
						}
					});
				} else if (msg && (msg.type == 'pass' || msg.type == 'fail')) {
					// console.log('MASTER - TEST RESULT ' + msg.title + ' = ' + msg.type);
					var r = results[msg.pid + ':' + msg.title] = {
						result: msg.type
					};
					if (msg.type == 'fail') {
						r.error = msg.error;
					}
				} else {
					w.kill();
				}
			});
		} else {
			console.log('Summary:');

			runner.on('end', function () {
				process.exit(0);
			});

			runner.runSuite(runner.suite, function () {
				runner.emit('end');
			});
		}
	}

	// find all tests
	var files = (function walk(dir) {
		var ff = [];
		fs.readdirSync(dir).forEach(function (name) {
			var file = path.join(dir, name);
			if (fs.statSync(file).isDirectory()) {
				ff = ff.concat(walk(file));
			} else if (/^test\-.+\.js$/.test(name)) {
				ff.push(file);
			}
		});
		return ff;
	}(__dirname));

	var runner, reporter;

	Mocha.interfaces.bdd = function (suite) {
		var suites = [suite];

		suite.on('pre-require', function (context, file, mocha) {
			context.before = function (fn) {
				suites[0].beforeAll(fn);
			};

			context.after = function (fn) {
				suites[0].afterAll(fn);
			};

			context.beforeEach = function (fn) {
				suites[0].beforeEach(fn);
			};

			context.afterEach = function (fn) {
				suites[0].afterEach(fn);
			};

			context.describe = context.context = function (title, fn) {
				var suite = Suite.create(suites[0], title);
				suites.unshift(suite);
				fn.call(suite);
				suites.shift();
				return suite;
			};

			context.xdescribe = context.xcontext = context.describe.skip = function (title, fn) {
				suite.pending = true;
				suites.unshift(suite);
				fn.call(suite);
				suites.shift();
			};

			context.describe.only = function (title, fn) {
				var suite = context.describe(title, fn);
				mocha.grep(suite.fullTitle());
			};

			context.it = context.specify = function (title, fn) {
				var suite = suites[0];
				if (suite.pending) var fn = null;
				var test = new Test(title, fn);
				suite.addTest(test);
				return test;
			};

			context.it.only = function (title, fn) {
				var test = context.it(title, fn);
				mocha.grep(test.fullTitle());
			};

			context.xit = context.xspecify = context.it.skip = function (title) {
				context.it(title);
			};
		});
	};

	cluster.on('exit', function (worker, code, signal) {
		createWorker(files.shift());
	});

	Base.list = function(){}; // silence errors

	function Summary(runner) {
		Base.call(this, runner);
		runner.on('end', this.epilogue.bind(this));
	}
	Summary.prototype.__proto__ = Base.prototype;

	mocha.reporter(Summary).ui('bdd').checkLeaks();
	mocha.suite.emit('pre-require', global, 'fake', mocha);

	runner = new Mocha.Runner(mocha.suite);
	reporter = new mocha._reporter(runner);
	runner.emit('start');

	createWorker(files.shift());
} else {
	// worker

	Mocha.interfaces.bdd = function (suite) {
		var suites = [suite];

		suite.on('pre-require', function (context, file, mocha) {
			context.before = function (fn) {
				suites[0].beforeAll(fn);
			};

			context.after = function (fn) {
				suites[0].afterAll(fn);
			};

			context.beforeEach = function (fn) {
				suites[0].beforeEach(fn);
			};

			context.afterEach = function (fn) {
				suites[0].afterEach(fn);
			};

			context.describe = context.context = function (title, fn) {
				process.send({ type: 'describe', title: title, pid: process.pid });
				var suite = Suite.create(suites[0], title);
				suites.unshift(suite);
				fn.call(suite);
				suites.shift();
				return suite;
			};

			context.xdescribe = context.xcontext = context.describe.skip = function (title, fn) {
				var suite = Suite.create(suites[0], title);
				suite.pending = true;
				suites.unshift(suite);
				fn.call(suite);
				suites.shift();
			};

			context.describe.only = function (title, fn) {
				var suite = context.describe(title, fn);
				mocha.grep(suite.fullTitle());
			};

			context.it = context.specify = function (title, fn) {
				process.send({ type: 'it', title: title, pid: process.pid });
				var suite = suites[0];
				if (suite.pending) var fn = null;
				var test = new Test(title, fn);
				suite.addTest(test);
				return test;
			};

			context.it.only = function (title, fn) {
				var test = context.it(title, fn);
				mocha.grep(test.fullTitle());
			};

			context.xit = context.xspecify = context.it.skip = function (title) {
				context.it(title);
			};
		});
	};

	process.on('message', function (msg) {
		var cursor = Base.cursor,
			color = Base.color;

		function Spec(runner) {
			Base.call(this, runner);

			var self = this,
				stats = this.stats,
				indents = 0,
				n = 0;

			function indent() {
				return Array(indents).join('  ')
			}

			//runner.on('start', function(){
			//	console.log();
			//});

			runner.on('suite', function (suite) {
				++indents;
				console.log(color('suite', '%s%s'), indent(), suite.title);
			});

			runner.on('suite end', function (suite) {
				--indents;
				//if (1 == indents) console.log();
			});

			//runner.on('test', function (test) {
			//	process.stdout.write(indent() + color('pass', '  ◦ ' + test.title + ': '));
			//});

			runner.on('pending', function (test) {
				var fmt = indent() + color('pending', '  - %s');
				console.log(fmt, test.title);
			});

			runner.on('pass', function (test) {
				if ('fast' == test.speed) {
					var fmt = indent()
						+ color('checkmark', '  ' + Base.symbols.ok)
						+ color('pass', ' %s ');
					//cursor.CR();
					console.log(fmt, test.title);
				} else {
					var fmt = indent()
						+ color('checkmark', '  ' + Base.symbols.ok)
						+ color('pass', ' %s ')
						+ color(test.speed, '(%dms)');
					// cursor.CR();
					console.log(fmt, test.title, test.duration);
				}
			});

			runner.on('fail', function (test, err) {
				//cursor.CR();
				console.log(indent() + color('fail', '  %d) %s'), ++n, test.title);
			});

			runner.on('end', self.epilogue.bind(self));
		}

		Spec.prototype.__proto__ = Base.prototype;

		mocha.reporter(Spec).ui('bdd').checkLeaks();
		mocha.suite.slow('1s');
		mocha.files = [ msg.file ];
		mocha.loadFiles();

		var runner = new Mocha.Runner(mocha.suite),
			reporter = new mocha._reporter(runner);

		runner.ignoreLeaks = false;
		runner.asyncOnly = false;

		runner.on('pass', function (test) {
			// console.log('WORKER - PASS ' + test.title);
			process.send({ type: 'pass', title: test.title, pid: process.pid });
		});

		runner.on('fail', function (test, err) {
			// console.log('WORKER - FAIL ' + test.title);
			process.send({ type: 'fail', title: test.title, error: err, pid: process.pid });
		});

		runner.run(function (code) {
			process.send({ result: code });
		});
	});
}
*/
