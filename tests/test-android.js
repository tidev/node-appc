/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index');

describe('android', function () {
	it('namespace exists', function () {
		appc.should.have.property('android');
		appc.android.should.be.a('object');
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			this.timeout('10s');
			this.slow('5s');

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

				result.avds.should.be.an.instanceOf(Array);

				if (result.exe !== null) {
					result.exe.should.be.a('string');
				}

				done();
			});
		});
	});
});