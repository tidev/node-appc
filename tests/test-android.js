var appc = require('../index');

describe('android', function () {
	it('namespace exists', function () {
		appc.should.have.property('android');
		appc.android.should.be.a('object');
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			appc.android.detect(function (result) {
				if (result == undefined) {
					return done();
				}

				result.should.be.a('object');

				if (result.sdkPath !== null) {
					result.sdkPath.should.be.a('string');
				}

				if (result.java !== null) {
					result.java.should.be.a('object');

					result.java.version.should.be.a('string');
					result.java.version.should.match(/^(\d+\.)?(\d+\.)?(\*|\d+)$/);

					result.java.build.should.be.a('string');
					result.java.build.should.match(/^\d+$/);
				}

				if (result.ndk !== null) {
					result.ndk.should.be.a('object');

					result.ndk.path.should.be.a('string');

					result.ndk.version.should.be.a('string');
				}

				result.targets.should.be.ok;
				result.targets.should.be.a('object');

				Object.keys(result.targets).forEach(function (id) {
					result.targets[id].should.be.a('object');

					var props = ['id', 'name', 'type', 'api-level', 'revision', 'skins', 'abis', 'path', 'based-on', 'libraries', 'vendor', 'description'];
					Object.keys(result.targets[id]).forEach(function (prop) {
						props.should.include(prop);
					});
				});

				result.avds.should.be.an.instanceOf(Array);

				result.avds.forEach(function (avd) {
					avd.should.be.a('object');

					var props = ['name', 'path', 'target', 'abi', 'skin', 'sdcard', 'based-on'];
					Object.keys(avd).forEach(function (prop) {
						props.should.include(prop);
					});
				});

				if (result.exe !== null) {
					result.exe.should.be.a('string');
				}

				done();
			});
		});
	});
});