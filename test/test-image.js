/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var appc = require('../index'),
	fs = require('fs'),
	path = require('path');

global.should = null;
global.should = require('should');

describe('image', function () {
	it('namespace exists', function () {
		appc.should.have.property('image');
		appc.image.should.be.an.Object;
	});

	function checkInfo(info, alpha) {
		should(info).be.an.Object;
		should(info).have.keys('height', 'width', 'alpha');
		should(info.height).be.a.Number;
		should(info.height).equal(180);
		should(info.width).be.a.Number;
		should(info.width).equal(180);
		should(info.alpha).be.a.Boolean;
		should(info.alpha).equal(alpha);
	}

	describe('#pngInfo()', function () {
		it('should detect 24-bit image', function () {
			var contents = fs.readFileSync(path.join(__dirname, 'resources', '24bit.png'));
			var info = appc.image.pngInfo(contents);
			checkInfo(info, false);
		});

		it('should detect 32-bit image', function () {
			var contents = fs.readFileSync(path.join(__dirname, 'resources', '32bit.png'));
			var info = appc.image.pngInfo(contents);
			checkInfo(info, true);
		});
	});
});
