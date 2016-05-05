import appc from '../src/index';

describe('subprocess', () => {
	describe('which()', () => {
		it('should find a well-known executable', done => {
			appc.subprocess.which('echo')
				.then(executable => {
					expect(executable).to.be.a.String;
					expect(executable).to.not.equal('');
					done();
				})
				.catch(done);
		});

		it('should not find an invalid executable', done => {
			appc.subprocess.which('no_way_does_this_already_exist')
				.then(executable => {
					done(new Error('Somehow there\'s an executable called "no_way_does_this_already_exist"'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					done();
				});
		});
	});

	describe('run()', () => {
		it('should run a subprocess that exits successfully', done => {
			appc.subprocess.run(process.execPath, ['-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(0);'])
				.then(({ code, stdout, stderr }) => {
					expect(code).to.equal(0);
					expect(stdout).to.equal('foo');
					expect(stderr).to.equal('bar');
					done();
				})
				.catch(done);
		});

		it('should run a subprocess that exits unsuccessfully', done => {
			appc.subprocess.run(process.execPath, ['-e', 'process.stdout.write("foo");process.stderr.write("bar");process.exit(1);'])
				.then(({ code, stdout, stderr }) => {
					done(new Error('Expected subprocess to fail'));
				})
				.catch(({ code, stdout, stderr }) => {
					expect(code).to.equal(1);
					expect(stdout).to.equal('foo');
					expect(stderr).to.equal('bar');
					done();
				});
		});

		it('should run a subprocess without args and without options', done => {
			appc.subprocess.run('echo')
				.then(({ code, stdout, stderr }) => {
					expect(code).to.equal(0);
					expect(stderr).to.equal('');
					done();
				})
				.catch(done);
		});

		it('should run a subprocess without args and with options', done => {
			appc.subprocess.run('echo', {})
				.then(({ code, stdout, stderr }) => {
					expect(code).to.equal(0);
					expect(stderr).to.equal('');
					done();
				})
				.catch(done);
		});
	});
});
