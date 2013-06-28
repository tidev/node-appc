var assert = require("assert"),
	getType = function (it) {
		return Object.prototype.toString.call(it).replace(/^\[object (.+)\]$/, '$1');
	};

describe('android', function () {
	it('namespace exists', function () {
		assert(!!require('../index').android, 'android namespace does not exist');
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			require('../index').android.detect(function (result) {
				var type = getType(result);
				if (type === void 0) return done();
				assert(type === 'Object', 'android detection result was a ' + type + ', expected an Object');

				// sdkPath
				type = getType(result.sdkPath);
				assert.notEqual(result.sdkPath, void 0, 'android detection result missing "sdkPath" property');
				assert(result.sdkPath === null || type == 'String', 'android detection result has invalid "sdkPath" property: ' + result.sdkPath + ' (' + type + ', expected a String)');

				// java
				type = getType(result.java);
				assert.notEqual(result.java, undefined, 'android detection result missing "java" property');
				assert.equal(type, 'Object', 'android detection result has invalid "java" property: ' + result.java + '(' + type + ', expected an Object)');

				// java.version
				type = getType(result.java.version);
				assert.notEqual(result.java.version, undefined, 'android detection result missing "java.version" property');
				assert(result.java.version === null || (type == 'String' && /^(\d+\.)?(\d+\.)?(\*|\d+)$/.test(result.java.version)), 'android detection result has invalid "java.version" property: ' + result.java.version + ' (' + type + ', expected a String in format x.y.z)');

				// java.build
				type = getType(result.java.build);
				assert.notEqual(result.java.build, undefined, 'android detection result missing "java.build" property');
				assert(result.java.build === null || (type === 'String' && /^\d+$/.test(result.java.build)), 'android detection result has invalid "java.build" property: ' + result.java.build + ' (' + type + ', expected a String containing digits only)');

				// ndk
				type = getType(result.ndk);
				assert.notEqual(result.ndk, undefined, 'android detection result missing "ndk" property');
				assert.equal(type, 'Object', 'android detection result has invalid "ndk" property: ' + result.ndk + ' (' + type + ', expected an Object)');

				// ndk.path
				type = getType(result.ndk.path);
				assert.notEqual(result.ndk.path, undefined, 'android detection result missing "ndk.path" property');
				assert.equal(type, 'String', 'android detection result has invalid "ndk.path" property: ' + result.ndk.path + ' (' + type + ', expected a String)');

				// ndk.version
				type = getType(result.ndk.version);
				assert.notEqual(result.ndk.version, undefined, 'android detection result missing "ndk.version" property');
				assert.equal(type, 'String', 'android detection result has invalid "ndk.version" property: ' + result.ndk.version + ' (' + type + ', expected a String)');

				// targets
				type = getType(result.targets);
				assert.notEqual(result.targets, undefined, 'android detection result missing "targets" property');
				assert.equal(type, 'Object', 'android detection result has invalid "targets" property: ' + result.targets + ' (' + type + ', expected an Object)');

				Object.keys(result.targets).forEach(function (id) {
					var type = getType(result.targets[id]);
					assert.equal(type, 'Object', 'android detection result has invalid "targets" property: ' + result.targets[id] + ' (' + type + ', expected an Object)');

					Object.keys(result.targets[id]).forEach(function (prop) {
						assert(['id', 'name', 'type', 'api-level', 'revision', 'skins', 'abis', 'path', 'based-on', 'libraries', 'vendor', 'description'].indexOf(prop) != -1, 'android detection result has invalid target "' + id + '"; unknown property: ' + prop);
					});
				});

				// avds
				type = getType(result.avds);
				assert.notEqual(result.avds, undefined, 'android detection result missing "avds" property');
				assert.equal(type, 'Array', 'android detection result has invalid "avds" property: ' + result.avds + ' (' + type + ', expected an Array)');

				result.avds.forEach(function (avd, idx) {
					var type = getType(avd);
					assert.equal(type, 'Object', 'android detection result has invalid "avd" at index ' + idx + ': ' + avd + ' (' + type + ', expected an Object)');

					Object.keys(avd).forEach(function (prop) {
						assert(['name', 'path', 'target', 'abi', 'skin', 'sdcard', 'based-on'].indexOf(prop) != -1, 'android detection result has invalid avd at index ' + idx + '"; unknown property: ' + prop);
					});
				});

				// exe
				type = getType(result.exe);
				assert.notEqual(result.exe, undefined, 'android detection result missing "exe" property');
				assert.equal(type, 'String', 'android detection result has invalid "exe" property: ' + result.exe + ' (' + type + ', expected an String)');

				done();
			});
		});
	});
});