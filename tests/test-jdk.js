var assert = require("assert"),
	getType = function (it) {
		return Object.prototype.toString.call(it).replace(/^\[object (.+)\]$/, '$1');
	};

describe('jdk', function () {
	it('namespace exists', function () {
		assert(!!require('../index').jdk, 'jdk namespace does not exist');
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			require('../index').jdk.detect(function (result) {
				var type = getType(result);
				assert(type === 'Object', 'jdk detection result was a ' + type + ', expected an Object');

				// version
				type = getType(result.version);
				assert.notEqual(result.version, undefined, 'jdk detection result missing "version" property');
				assert(result.version === null || (type == 'String' && /^(\d+\.)?(\d+\.)?(\*|\d+)$/.test(result.version)), 'jdk detection result has invalid "version" property: ' + result.version + ' (' + type + ', expected an String in format x.y.z)');

				// build
				type = getType(result.build);
				assert.notEqual(result.build, undefined, 'jdk detection result missing "build" property');
				assert(result.build === null || (type === 'String' && /^\d+$/.test(result.build)), 'jdk detection result has invalid "build" property: ' + result.build + ' (' + type + '), expected a String containing digits only)');

				// executables
				type = getType(result.executables);
				assert.notEqual(result.executables, undefined, 'jdk detection result missing "executables" property');
				assert(result.executables === null || type === 'Object', 'jdk detection result has invalid "executables" property: ' + result.executables + ' (' + type + ', expected an Object)');

				// issues
				type = getType(result.issues);
				assert.notEqual(result.issues, undefined, 'jdk detection result missing "issues" property');
				assert(result.issues === null || type === 'Array', 'jdk detection result has invalid "issues" property: ' + result.issues + ' (' + type + ', expected an Array)');

				done();
			});
		});
	});
});