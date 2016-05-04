import appc from '../src/index';

describe('util', () => {
	describe('commonSearchPaths', () => {
		expect(appc.util.searchPaths).to.be.an.Array;
	});

	describe('expand()', () => {
		beforeEach(function () {
			this.HOME = process.env.HOME;
			this.USERPROFILE = process.env.USERPROFILE;
		});

		afterEach(function () {
			process.env.HOME = this.HOME;
			process.env.USERPROFILE = this.USERPROFILE;
		});

		it('should resolve the home directory using HOME', () => {
			process.env.HOME = '/Users/username';
			const p = appc.path.expand('~/foo');
			expect(p).to.equal('/Users/username/foo');
		});

		it('should resolve the home directory using USERPROFILE', () => {
			process.env.HOME = '';
			process.env.USERPROFILE = '/Users/username';
			const p = appc.path.expand('~/foo');
			expect(p).to.equal('/Users/username/foo');
		});

		it('should collapse relative segments', () => {
			const p = appc.path.expand('/path/./to/../foo');
			expect(p).to.equal('/path/foo');
		});
	});
});
