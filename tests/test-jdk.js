/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index');

function MockConfig() {
	this.get = function (s, d) {
		return d;
	};
}

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
			appc.jdk.detect(new MockConfig, function (result) {
				result.should.be.a('object');
				done();
			});
		});

		it('should return valid result with a config and options', function (done) {
			appc.jdk.detect(new MockConfig, { bypassCache: true }, function (result) {
				result.should.be.a('object');
				done();
			});
		});
	});
});