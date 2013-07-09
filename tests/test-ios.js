/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index');

describe('ios', function () {
	it('namespace exists', function () {
		appc.should.have.property('ios');
		appc.ios.should.be.a('object');
	});

	describe('#detect()', function () {
		it('result is valid', function (done) {
			this.timeout('5s');

			appc.ios.detect(function (result) {
				if (result == undefined) {
					return done();
				}

				result.should.be.a('object');

				result.should.have.property('xcode');
				result.xcode.should.be.a('object');
				Object.keys(result.xcode).forEach(function (ver) {
					result.xcode[ver].should.be.a('object');
					result.xcode[ver].should.have.property('path');
					result.xcode[ver].should.have.property('xcodeapp');
					result.xcode[ver].should.have.property('xcodebuild');
					result.xcode[ver].should.have.property('selected');
					result.xcode[ver].should.have.property('version');
					result.xcode[ver].should.have.property('build');
					result.xcode[ver].should.have.property('sdks');
					result.xcode[ver].should.have.property('sims');
					result.xcode[ver].path.should.be.a('string');
					result.xcode[ver].xcodeapp.should.be.a('string');
					result.xcode[ver].xcodebuild.should.be.a('string');
					result.xcode[ver].selected.should.be.a('boolean');
					result.xcode[ver].version.should.be.a('string');
					result.xcode[ver].build.should.be.a('string');
					result.xcode[ver].sdks.should.be.an.instanceOf(Array);
					result.xcode[ver].sims.should.be.an.instanceOf(Array);
				});

				result.should.have.property('certs');
				result.certs.should.be.a('object');

				result.certs.should.have.property('keychains');
				result.certs.keychains.should.be.a('object');
				Object.keys(result.certs.keychains).forEach(function (keychain) {
					result.certs.keychains[keychain].should.be.a('object');
					if (result.certs.keychains[keychain].developer) {
						result.certs.keychains[keychain].developer.should.be.an.instanceOf(Array);
						result.certs.keychains[keychain].developer.forEach(function (d) {
							d.should.be.a('string');
						});
					}
					if (result.certs.keychains[keychain].distribution) {
						result.certs.keychains[keychain].distribution.should.be.an.instanceOf(Array);
						result.certs.keychains[keychain].distribution.forEach(function (d) {
							d.should.be.a('string');
						});
					}
				});

				result.certs.should.have.property('wwdr');
				result.certs.wwdr.should.be.a('boolean');

				result.certs.should.have.property('devNames');
				result.certs.devNames.should.be.an.instanceOf(Array);
				result.certs.devNames.forEach(function (d) {
					d.should.be.a('string');
				});

				result.certs.should.have.property('distNames');
				result.certs.distNames.should.be.an.instanceOf(Array);
				result.certs.distNames.forEach(function (d) {
					d.should.be.a('string');
				});

				result.should.have.property('provisioningProfiles');
				result.provisioningProfiles.should.be.a('object');

				result.provisioningProfiles.should.have.property('adhoc');
				['adhoc', 'enterprise', 'development', 'distribution'].forEach(function (type) {
					result.provisioningProfiles[type].should.be.an.instanceOf(Array);
					result.provisioningProfiles[type].forEach(function (pp) {
						pp.should.be.a('object');
						pp.should.have.property('uuid');
						pp.should.have.property('name');
						pp.should.have.property('appPrefix');
						pp.should.have.property('appId');
						pp.should.have.property('getTaskAllow');
						pp.should.have.property('apsEnvironment');
						pp.uuid.should.be.a('string');
						pp.name.should.be.a('string');
						pp.appPrefix.should.be.a('string');
						pp.appId.should.be.a('string');
						pp.getTaskAllow.should.be.a('boolean');
						pp.apsEnvironment.should.be.a('string');
					});
				});

				result.should.have.property('keychains');
				result.keychains.should.be.an.instanceOf(Array);
				result.keychains.forEach(function (keychain) {
					keychain.should.be.a('string');
				});

				done();
			});
		});
	});
});