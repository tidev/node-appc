import appc from '../src/index';

const _it = process.platform === 'win32' ? it : it.skip;

describe('windows', () => {
	describe('registry', () => {
		_it('should query an existing key', done => {
			appc.windows.registry.query('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'ProductName')
				.then(value => {
					expect(value).to.be.a.String;
					expect(value).to.not.equal('');
					done();
				})
				.catch(done);
		});

		_it('should non-existent key', done => {
			appc.windows.registry.query('HKLM', 'SOFTWARE\\DoesNotExist', 'DoesNotExist')
				.then(value => {
					expect(value).to.be.null;
					done();
				})
				.catch(done);
		});

		_it('should non-existent key value', done => {
			appc.windows.registry.query('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'DoesNotExist')
				.then(value => {
					expect(value).to.be.null;
					done();
				})
				.catch(done);
		});
	});
});
