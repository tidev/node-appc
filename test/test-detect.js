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

		it('should reject if env is not a string', done => {
			appc.detect
				.getPaths({ env: 123 })
				.then(() => {
					done(new Error('Expected rejection'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected env to be a string or an array of strings');
					done();
				})
				.catch(done);
		});

		it('should reject if env is not an array of strings', done => {
			appc.detect
				.getPaths({ env: ['foo', 123] })
				.then(() => {
					done(new Error('Expected rejection'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected env to be a string or an array of strings');
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

		it('should not find a path when executable does not exist', done => {
			process.env.PATH = path.join(__dirname, 'mocks', 'detect');

			const executable = 'doesnotexist' + appc.subprocess.exe;

			appc.detect
				.getPaths({ executable })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(0);
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

		it('should not find a path when the path is not a directory', done => {
			appc.detect
				.getPaths({ paths: __filename })
				.then(results => {
					expect(results).to.be.an.Array;
					expect(results).to.have.lengthOf(0);
					done();
				})
				.catch(done);
		});

		it('should reject if paths is not a string', done => {
			appc.detect
				.getPaths({ paths: 123 })
				.then(() => {
					done(new Error('Expected rejection'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected paths to be a string or an array of strings');
					done();
				})
				.catch(done);
		});

		it('should reject if paths is not an array of strings', done => {
			appc.detect
				.getPaths({ paths: ['foo', 123] })
				.then(() => {
					done(new Error('Expected rejection'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(TypeError);
					expect(err.message).to.equal('Expected paths to be a string or an array of strings');
					done();
				})
				.catch(done);
		});
	});

	describe('Scanner', () => {
		it('should reject if detectFn is not a function', done => {
			new appc.detect.Scanner()
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
			new appc.detect.Scanner()
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
			new appc.detect.Scanner()
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

			const scanner = new appc.detect.Scanner();

			scanner
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);

					opts.force = false;

					return scanner
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

			const scanner = new appc.detect.Scanner();

			scanner
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					return scanner
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

			new appc.detect.Scanner()
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

			new appc.detect.Scanner()
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
			new appc.detect.Scanner()
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
			const scanner = new appc.detect.Scanner();
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

			scanner
				.scan(opts)
				.then(results => {
					expect(results).to.deep.equal([ { foo: 'bar' } ]);
					return scanner
						.scan(opts)
						.then(results => {
							expect(results).to.deep.equal([ { baz: 'wiz' } ]);
							done();
						});
				})
				.catch(done);
		});

		it('should only re-detect for a specific path', done => {
			let counter = 0;
			const scanner = new appc.detect.Scanner();
			const fooPath = path.resolve('./test/mocks/detect/foo');
			const barPath = path.resolve('./test/mocks/detect/bar');

			scanner
				.scan({
					detectFn: dir => {
						expect(dir).to.be.oneOf([ fooPath, barPath ]);
						counter++;
						return { path: dir };
					},
					paths: [ fooPath, barPath ]
				})
				.then(results => {
					expect(counter).to.equal(2);
					expect(results).to.deep.equal([
						{ path: fooPath },
						{ path: barPath }
					]);

					return scanner
						.scan({
							detectFn: dir => {
								expect(dir).to.equal(fooPath);
								expect(++counter).to.equal(3);
								return { path: 'foo path' };
							},
							paths: [ fooPath, barPath ],
							onlyPaths: [ fooPath ],
							force: true
						})
						.then(results => {
							expect(results).to.deep.equal([
								{ path: 'foo path' },
								{ path: barPath }
							]);
							done();
						});
				})
				.catch(done);
		});
	});

	describe('WatchHandle', () => {
		it('should unwatch all watchers', () => {
			const w = new appc.detect.WatchHandle();
			const unwatch = sinon.spy();
			w.unwatchers.set('foo', unwatch);
			w.stop();
			w.stop();
			expect(unwatch.calledOnce);
		});
	});
});
