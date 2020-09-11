/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
/* eslint no-unused-expressions: "off" */
'use strict';

const appc = require('../index'),
	assert = require('assert'),
	fs = require('fs'),
	path = require('path'),
	temp = require('temp');
require('should');

describe('zip', function () {
	it('namespace exists', function () {
		appc.should.have.property('zip');
		appc.zip.should.be.an.Object();
	});

	describe('#extractAll()', function () {
		it('should extract all files with correct permissions', function (done) {
			const tempDir = temp.mkdirSync();
			appc.zip.unzip(path.join(__dirname, 'resources', 'test.zip'), tempDir, null, function (err) {
				assert(!err, 'expected unzip to not error');

				fs.existsSync(path.join(tempDir, 'main.m')).should.be.ok();
				(fs.statSync(path.join(tempDir, 'main.m')).mode & 0o777).should.equal(process.platform === 'win32' ? 0o666 : 0o644);

				fs.existsSync(path.join(tempDir, 'ios-sim')).should.be.ok();
				(fs.statSync(path.join(tempDir, 'ios-sim')).mode & 0o777).should.equal(process.platform === 'win32' ? 0o666 : 0o755);

				done();
			});
		});

		it('should preserve symlinks', function (done) {
			const tempDir = temp.mkdirSync();
			appc.zip.unzip(path.join(__dirname, 'resources', 'symlinks.zip'), tempDir, null, function (err) {
				assert(!err, 'expected unzip to not error');

				fs.existsSync(path.join(tempDir, 'symlinks/folder')).should.be.true();
				const stat3 = fs.statSync(path.join(tempDir, 'symlinks/folder'));
				stat3.isDirectory().should.be.true();

				fs.existsSync(path.join(tempDir, 'symlinks/folder/testfile.txt')).should.be.true();
				const stat4 = fs.statSync(path.join(tempDir, 'symlinks/folder/testfile.txt'));
				stat4.isDirectory().should.be.false();
				stat4.isFile().should.be.true();

				fs.existsSync(path.join(tempDir, 'symlinks/link.txt')).should.be.true();
				const stat = fs.lstatSync(path.join(tempDir, 'symlinks/link.txt'));
				stat.isSymbolicLink().should.be.true(); // fails here

				const p = path.join(tempDir, 'symlinks/folderlink');
				fs.existsSync(p).should.be.true();
				const stat2 = fs.lstatSync(p);
				stat2.isSymbolicLink().should.be.true(); // fails here
				const target = fs.readlinkSync(p);
				target.should.eql('folder/');

				done();
			});
		});
	});
});
