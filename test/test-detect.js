import appc from '../src/index';
import path from 'path';

describe('detect', () => {
	describe('getPaths()', () => {
		beforeEach(function () {
			this.PATH = process.env.PATH;
		});

		afterEach(function () {
			process.env.PATH = this.PATH;
			delete process.env.DETECT_TEST_PATH;
			delete process.env.DETECT_TEST_PATH2;
		});

		it('should return an empty array', done => {
			appc.detect
				.getPaths()
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});

		it('should return an array with an environment variable path', done => {
			process.env.DETECT_TEST_PATH = __dirname;

			appc.detect
				.getPaths({ env: 'DETECT_TEST_PATH' })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(1);
					expect(results[0]).to.equal(__dirname);
					done();
				})
				.catch(done);
		});

		it('should return an array with multiple environment variable paths', done => {
			process.env.DETECT_TEST_PATH = __dirname;
			process.env.DETECT_TEST_PATH2 = path.join(__dirname, 'foo');

			appc.detect
				.getPaths({ env: [ 'DETECT_TEST_PATH', 'DETECT_TEST_PATH2' ] })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(2);
					expect(results[0]).to.equal(__dirname);
					expect(results[1]).to.equal(path.join(__dirname, 'foo'));
					done();
				})
				.catch(done);
		});

		it('should return an array with the executable directory', done => {
			process.env.PATH = path.join(__dirname, 'mocks', 'detect');

			const executable = 'test' + appc.subprocess.exe;

			appc.detect
				.getPaths({ executable })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(1);
					expect(results[0]).to.equal(process.env.PATH);
					done();
				})
				.catch(done);
		});

		it('should return an array with a single path', done => {
			appc.detect
				.getPaths({ paths: __dirname })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(1);
					expect(results[0]).to.equal(__dirname);
					done();
				})
				.catch(done);
		});

		it('should return an array with multiple paths', done => {
			appc.detect
				.getPaths({ paths: [ __dirname, path.join(__dirname, 'foo') ] })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(2);
					expect(results[0]).to.equal(__dirname);
					expect(results[1]).to.equal(path.join(__dirname, 'foo'));
					done();
				})
				.catch(done);
		});
	});

	describe('scan()', () => {
		afterEach(() => {
			appc.detect.resetCache();
		});

		it('should reject if detectFn is not a function', done => {
			appc.detect
				.scan({})
				.then(results => {
					done(new Error('Expected detect to throw error'));
				})
				.catch(err => {
					try {
						expect(err).to.be.a.TypeError;
						expect(err.message).to.equal('Expected detectFn to be a function');
						done();
					} catch (e) {
						done(e);
					}
				});
		});

		it('should reject if paths is not an array', done => {
			appc.detect
				.scan({ detectFn: () => {} })
				.then(results => {
					done(new Error('Expected detect to throw error'));
				})
				.catch(err => {
					try {
						expect(err).to.be.a.TypeError;
						expect(err.message).to.equal('Expected paths to be an array');
						done();
					} catch (e) {
						done(e);
					}
				});
		});

		it('should call detect function for each path', done => {
			appc.detect
				.scan({
					detectFn: dir => {
						expect(dir).to.equal(__dirname);
						return { foo: 'bar' };
					},
					paths: [ __dirname ],
					force: true
				})
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					done();
				})
				.catch(done);
		});

		it('should return cache for non-forced second call', done => {
			const opts = {
				detectFn: dir => {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);

					opts.force = false;

					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results).to.deep.equal([ { foo: 'bar' } ]);
							done();
						});
				})
				.catch(done);
		});

		it('should return cache for forced second call', done => {
			const opts = {
				detectFn: dir => {
					expect(dir).to.equal(__dirname);
					return { foo: 'bar' };
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results).to.deep.equal([ { foo: 'bar' } ]);
							done();
						});
				})
				.catch(done);
		});

		it('should handle a path that does not exist', done => {
			const p = path.join(__dirname, 'doesnotexist');
			appc.detect
				.scan({
					detectFn: dir => {
						expect(dir).to.equal(p);
						return null;
					},
					paths: [ p ],
					force: true
				})
				.then(results => {
					expect(results).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});

		it('should scan subdirectories if detect function returns falsey result', done => {
			const m = path.join(__dirname, 'mocks');
			const p = path.join(__dirname, 'mocks', 'detect');

			appc.detect
				.scan({
					detectFn: dir => {
						if (dir === p) {
							return { foo: 'bar' };
						}
					},
					paths: [ m ],
					force: true,
					depth: 1
				})
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					done();
				})
				.catch(done);
		});

		it('should return multiple results', done => {
			appc.detect
				.scan({
					detectFn: dir => {
						return [
							{ foo: 'bar' },
							{ baz: 'wiz' }
						];
					},
					paths: [ __dirname ],
					force: true
				})
				.then(results => {
					expect(results).to.deep.equal([
						{ foo: 'bar' },
						{ baz: 'wiz' }
					]);
					done();
				})
				.catch(done);
		});

		it('should update result after second call', done => {
			let counter = 0;
			const opts = {
				detectFn: dir => {
					expect(dir).to.equal(__dirname);
					if (++counter === 1) {
						return { foo: 'bar' };
					}
					return { baz: 'wiz' };
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results).to.deep.equal([ { baz: 'wiz' } ]);
							done();
						});
				})
				.catch(done);
		});
	});
});
