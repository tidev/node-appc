/**
 * node-appc - Appcelerator Common Library for Node.js
 * Copyright (c) 2009-2014 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
/* eslint no-unused-expressions: "off" */
'use strict';

const appc = require('../index');

describe('encoding', () => {
	it('namespace exists', () => {
		appc.should.have.property('encoding');
		appc.encoding.should.be.an.Object;
	});

	describe('#decodeOctalUTF8()', () => {
		it('decodes non-octal string', () => {
			appc.encoding.decodeOctalUTF8('titanium rocks').should.equal('titanium rocks');
		});

		it('decodes octal string', () => {
			appc.encoding.decodeOctalUTF8('testing \\303\\274 and \\351\\252\\236').should.equal('testing ü and 骞');
		});

		it('try to decode incomplete octal string', () => {
			appc.encoding.decodeOctalUTF8('testing \\').should.equal('testing \0');
		});
	});
});
