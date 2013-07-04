var appc = require('../index');

describe('encoding', function () {
	it('namespace exists', function () {
		appc.should.have.property('encoding');
		appc.encoding.should.be.a('object');
	});

	describe('#decodeOctalUTF8()', function () {
		it('decodes non-octal string', function () {
			appc.encoding.decodeOctalUTF8('titanium rocks').should.equal('titanium rocks');
		});

		it('decodes octal string', function () {
			appc.encoding.decodeOctalUTF8('testing \303\274 and \351\252\236').should.equal('testing ü and 骞');
		});
	});
});
