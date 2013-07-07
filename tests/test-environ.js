var appc = require('../index'),
	assert = require('assert'),
	fs = require('fs'),
	path = require('path');

describe('environ', function () {
	it('namespace exists', function () {
		appc.should.have.property('environ');
		appc.environ.should.be.a('object');
	});

	describe('#scanCommands()', function () {
		it('should find the test command', function () {
			var dest = {},
				searchPath = path.join(__dirname, 'resources', 'environ', 'commands'),
				testModule = path.join(searchPath, 'test'),
				testFile = path.join(searchPath, 'test.js');

			appc.environ.scanCommands(dest, searchPath);

			dest.should.have.property(testModule);
			dest[testModule].should.equal(testFile);
		});

		it('should find the test command', function () {
			var dest = {},
				searchPath = path.join(__dirname, 'resources', 'environ', 'commands'),
				hiddenModule = path.join(searchPath, '_hidden');

			appc.environ.scanCommands(dest, searchPath);

			dest.should.not.have.property(hiddenModule);
		});
	});

	describe('#getSDK()', function () {
		it('should return a Titanium SDK or null', function () {
			var result = appc.environ.getSDK();
			if (result) {
				result.should.be.a('object');
				result.should.have.property('commands');
				result.commands.should.be.a('object');
				result.should.have.property('name');
				result.name.should.be.a('string');
				result.name.should.be.ok;
				result.should.have.property('path');
				result.path.should.be.a('string');
				result.path.should.be.ok;
				fs.existsSync(result.path).should.be.ok;
				result.should.have.property('platforms');
				result.platforms.should.be.a('object');
			} else {
				assert.equal(result, null);
			}
		});
	});

	describe('#detectTitaniumSDKs()', function () {
		it('should detect installed Titanium SDKs', function () {
			appc.environ.detectTitaniumSDKs();
			if (Object.keys(appc.environ.sdks).length) {
				Object.keys(appc.environ.sdks).forEach(function (ver) {
					appc.environ.sdks[ver].should.be.a('object');

					appc.environ.sdks[ver].commands.should.be.a('object');

					appc.environ.sdks[ver].name.should.be.a('string');
					appc.environ.sdks[ver].name.should.be.ok;

					appc.environ.sdks[ver].path.should.be.a('string');
					appc.environ.sdks[ver].path.should.be.ok;

					fs.existsSync(appc.environ.sdks[ver].path).should.be.ok;
					appc.environ.sdks[ver].should.have.property('platforms');
					appc.environ.sdks[ver].platforms.should.be.a('object');
				});
			}
		});
	});

	describe('#getOSInfo()', function () {
		it('should find OS and Node.js info', function (done) {
			appc.environ.getOSInfo(function (results) {
				results.should.be.a('object');
				results.os.should.be.a('string');
				results.platform.should.be.a('string');
				results.osver.should.be.a('string');
				results.ostype.should.be.a('string');
				results.oscpu.should.be.a('number');
				results.memory.should.be.a('number');
				results.node.should.be.a('string');
				results.npm.should.be.a('string');
				done();
			});
		});

		it('should return cached info on subsequent calls', function (done) {
			appc.environ.getOSInfo(function (result1) {
				appc.environ.getOSInfo(function (result2) {
					result1.should.equal(result2);
					done();
				});
			});
		});
	});
});
