var appc = require('../index');

describe('async', function () {
	it('namespace exists', function () {
		appc.should.have.property('async');
		appc.async.should.be.a('object');
	});

	describe('#parallel()', function () {
		it('should run tasks in parallel using same context', function (done) {
			function TestObj() {
				this.counter = 0;
			}

			var obj = new TestObj;

			appc.async.parallel(obj, [
				function (next) {
					this.counter++;
					next();
				},
				function (next) {
					this.counter++;
					next();
				},
				function (next) {
					this.counter++;
					next();
				}
			], function () {
				obj.counter.should.equal(3);
				done();
			});
		});
	});

	describe('#series()', function () {
		it('should run tasks in series using same context', function (done) {
			function TestObj() {
				this.counter = 0;
			}

			var obj = new TestObj;

			appc.async.series(obj, [
				function (next) {
					this.counter++;
					next();
				},
				function (next) {
					this.counter++;
					next();
				},
				function (next) {
					this.counter++;
					next();
				}
			], function () {
				obj.counter.should.equal(3);
				done();
			});
		});
	});
});
