import appc from '../src/index';
import path from 'path';

describe('fs', () => {
	describe('existsSync()', () => {
		it('should check if a file exists', () => {
			expect(appc.fs.existsSync(path.resolve(__dirname, './setup.js'))).to.be.true;
			expect(appc.fs.existsSync(path.resolve(__dirname, './nosuchfile'))).to.be.false;
		});

		it('should check if a directory exists', () => {
			expect(appc.fs.existsSync(path.resolve(__dirname, './mocks'))).to.be.true;
			expect(appc.fs.existsSync(path.resolve(__dirname, './mocks/nosuchdir'))).to.be.false;
		});
	});

	describe('locate()', () => {
		//
	});

	describe('Watcher', () => {
		//
	});
});
