import appc from '../src/index';

const _it = process.platform === 'win32' ? it : it.skip;

describe('windows', () => {
	describe('registry', () => {
		describe('get()', () => {
			_it('should get an existing key', done => {
				appc.windows.registry.get('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'ProductName')
					.then(value => {
						expect(value).to.be.a.String;
						expect(value).to.not.equal('');
						done();
					})
					.catch(done);
			});

			_it('should handle non-existent key', done => {
				appc.windows.registry.get('HKLM', 'SOFTWARE\\DoesNotExist', 'DoesNotExist')
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err.code).to.equal(1);
						expect(err.message).to.equal('QUERY command exited with code 1:\n\nERROR: The system was unable to find the specified registry key or value.');
						done();
					});
			});

			_it('should handle non-existent key value', done => {
				appc.windows.registry.get('HKLM', 'SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'DoesNotExist')
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err.code).to.equal(1);
						expect(err.message).to.equal('QUERY command exited with code 1:\n\nERROR: The system was unable to find the specified registry key or value.');
						done();
					});
			});

			_it('should reject if hive is invalid', done => {
				appc.windows.registry.get(null)
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err).to.be.instanceof(TypeError);
						expect(err.message).to.equal('Expected hive to be a non-empty string');
						done();
					});
			});

			_it('should reject if hive is unknown type', done => {
				appc.windows.registry.get('foo')
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err).to.be.instanceof(Error);
						expect(err.message).to.equal('Invalid hive "foo", must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC"');
						done();
					});
			});

			_it('should reject if key is invalid', done => {
				appc.windows.registry.get('HKLM', null)
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err).to.be.instanceof(TypeError);
						expect(err.message).to.equal('Expected key to be a non-empty string');
						done();
					});
			});

			_it('should reject if name is invalid', done => {
				appc.windows.registry.get('HKLM', 'foo', null)
					.then(value => {
						done(new Error('Expected error'));
					})
					.catch(err => {
						expect(err).to.be.instanceof(TypeError);
						expect(err.message).to.equal('Expected name to be a non-empty string');
						done();
					});
			});
		});

		describe('keys()', () => {
			_it('should get all subkeys', done => {
				appc.windows.registry.keys('HKLM', 'SOFTWARE\\Microsoft\\Windows NT')
					.then(keys => {
						expect(keys).to.be.an.Array;
						expect(keys).to.include('\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion');
						done();
					})
					.catch(done);
			});

			_it('should handle non-existent key', done => {
				appc.windows.registry.keys('HKLM', 'SOFTWARE\\DoesNotExist')
					.then(keys => {
						expect(keys).to.be.an.Array;
						expect(keys).to.have.lengthOf(0);
						done();
					})
					.catch(done);
			});
		});
	});
});
