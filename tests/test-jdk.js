var appc = require('../index');

describe('jdk', function () {
	it('namespace exists', function () {
		appc.should.have.property('jdk');
		appc.jdk.should.be.a('object');
	});

	describe('#detect()', function () {
		it('should return valid result without specifying a config or options', function (done) {
			appc.jdk.detect(function (result) {
				result.should.be.a('object');

				if (result.version !== null) {
					result.version.should.be.a('string');
					result.version.should.match(/^(\d+\.)?(\d+\.)?(\*|\d+)$/);
				}

				if (result.build !== null) {
					result.build.should.be.a('string');
					result.build.should.match(/^\d+$/);
				}

				if (result.executables !== null) {
					result.executables.should.be.a('object');
				}

				if (result.issues !== null) {
					result.issues.should.be.an.instanceOf(Array);
				}

				done();
			});
		});

		it('should return valid result with a config and without specifying options', function (done) {
			appc.jdk.detect({}, function (result) {
				result.should.be.a('object');
				done();
			});
		});

		it('should return valid result with a config and options', function (done) {
			appc.jdk.detect({}, { bypassCache: true }, function (result) {
				result.should.be.a('object');
				done();
			});
		});
	});
});