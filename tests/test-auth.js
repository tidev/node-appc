/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index'),
	fs = require('fs'),
	path = require('path'),
	http = require('http'),
	temp = require('temp');
//	wrench = require('wrench');

describe('auth', function () {
	it('namespace exists', function () {
		appc.should.have.property('auth');
		appc.auth.should.be.a('object');
	});

	describe('#login()', function () {
		it('should fail with invalid login', function(done){
			// test invalid login
			this.timeout(30000);
			appc.auth.login({
				username: 'appctestlogin1234@appcelerator.com',
				password: 'whoknows',
				titaniumHomeDir: temp.mkdirSync(),	
				callback: function(result) {
					result.should.have.property('code');
					result.code.should.equal(appc.auth.AUTH_ERR_BAD_UN_OR_PW);
					appc.auth.resetMID();
					done();
				}
			});
		});
		it('should fail with invalid url', function(done){
			// test invalid login url
			this.timeout(10000);
			appc.auth.login({
				loginUrl: 'http://monkeyfart.fooasdadsasdasda.com',
				username: 'appctestlogin1234@appcelerator.com',
				password: 'whoknows',
				titaniumHomeDir: temp.mkdirSync(),	
				callback: function(result) {
					result.should.have.property('code');
					result.code.should.equal(appc.auth.AUTH_ERR_CONNECT_FAILURE);
					appc.auth.resetMID();
					done();
				}
			});
		});
	});

	describe('#logout()', function () {
		//
	});

	describe('#status()', function () {
		//
	});

	describe('#getMID()', function () {
		it('creates non-existant mid file', function (done) {
			var tempDir = temp.mkdirSync();
			appc.auth.getMID(tempDir, function (mid) {
				mid.should.be.a('string');
				fs.existsSync(path.join(tempDir, 'mid.json')).should.be.ok;
				done();
			});
		});

		it('results cached', function (done) {
			var tempDir = temp.mkdirSync();
			appc.auth.getMID(tempDir, function (result1) {
				appc.auth.getMID(tempDir, function (result2) {
					result1.should.equal(result2);
					done();
				});
			});
		});
	});
});
