/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
/* eslint no-unused-expressions: "off" */
'use strict';

const appc = require('../index');

describe('android', function () {
	it('namespace exists', function () {
		appc.should.have.property('android');
		appc.android.should.be.an.Object;
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			this.timeout('10s');
			this.slow('5s');

			appc.android.detect(function (result) {
				if (!result) {
					return done();
				}

				result.should.be.an.Object;

				if (result.sdkPath !== null) {
					result.sdkPath.should.be.a.String;
				}

				if (result.java !== null) {
					result.java.should.be.an.Object;

					result.java.should.have.a.property('version').which.is.a.String;
					result.java.version.should.match(/^(\d+\.)?(\d+\.)?(\*|\d+)$/);

					result.java.should.have.a.property('build').which.is.a.String;
					result.java.build.should.match(/^\d+(-[-a-zA-Z0-9.]+)?$/);
				}

				if (result.ndk !== null) {
					result.ndk.should.be.an.Object;

					result.ndk.path.should.be.a.String;

					result.ndk.version.should.be.a.String;
				}

				result.targets.should.be.ok;
				result.targets.should.be.an.Object;

				result.avds.should.be.an.instanceOf(Array);

				if (result.exe !== null) {
					result.exe.should.be.a.String;
				}

				done();
			});
		});
	});
});
