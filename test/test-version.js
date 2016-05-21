import appc from '../src/index';

describe('version', () => {
	describe('compare()', () => {
		it('should compare two versions', () => {
			expect(appc.version.compare('', '')).to.equal(0);
			expect(appc.version.compare('1', '1.0')).to.equal(0);
			expect(appc.version.compare('1', '1.0.0')).to.equal(0);
			expect(appc.version.compare('1.0.1', '1')).to.equal(1);
			expect(appc.version.compare('1.6', '2.2')).to.equal(-1);
			expect(appc.version.compare('1', '1.0.1')).to.equal(-1);
		});
	});
});
