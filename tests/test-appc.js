var appc = require('../index'),
	colors = require('colors');

describe('appc', function () {
	it('dump() integer', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(123);
			output.should.equal('123');
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() float', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(3.14);
			output.should.equal('3.14');
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() string', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump('titanium');
			output.should.equal("'titanium'");
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() boolean', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(true);
			output.should.equal('true');
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() null', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(null);
			output.should.equal('null');
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() undefined', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(undefined);
			output.should.equal('undefined');
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() array', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump(['a', 'b', 'c']);
			output.should.equal("[ 'a', 'b', 'c' ]");
			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});

	it('dump() object', function () {
		var tmp = console.error,
			output = '';

		console.error = function () {
			output += Array.prototype.slice.call(arguments).join(' ').stripColors;
		};

		try {
			dump({
				a: 1,
				b: 'ti',
				c: true,
				d: ['x', 'y', 'z'],
				e: {
					m: 2,
					n: false,
					o: 'appc'
				}
			});

			output.should.equal(
				"{ a: 1,\n" +
				"  b: 'ti',\n" +
				"  c: true,\n" +
				"  d: [ 'x', 'y', 'z' ],\n" +
				"  e: { m: 2, n: false, o: 'appc' } }");

			console.error = tmp;
		} catch (ex) {
			console.error = tmp;
			throw ex;
		}
	});
});
