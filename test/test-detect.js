import appc from '../src/index';
import path from 'path';

describe('detect', () => {
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

		it('should reject if hash is not a string', done => {
			appc.detect
				.scan({ detectFn: () => {}, paths: [], hash: 123, force: true })
				.then(results => {
					done(new Error('Expected detect to throw error'));
				})
				.catch(err => {
					try {
						expect(err).to.be.a.TypeError;
						expect(err.message).to.equal('Expected hash to be a string');
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
						return {
							id: 'foo',
							value: 'bar'
						};
					},
					paths: [ __dirname ],
					force: true
				})
				.then(results => {
					expect(results.toJS()).to.deep.equal({ foo: 'bar' });
					done();
				})
				.catch(done);
		});

		it('should return cache for non-forced second call', done => {
			const opts = {
				detectFn: dir => {
					expect(dir).to.equal(__dirname);
					return {
						id: 'foo',
						value: 'bar'
					};
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results.toJS()).to.deep.equal({ foo: 'bar' });

					opts.force = false;

					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results.toJS()).to.deep.equal({ foo: 'bar' });
							done();
						});
				})
				.catch(done);
		});

		it('should return cache for forced second call', done => {
			const opts = {
				detectFn: dir => {
					expect(dir).to.equal(__dirname);
					return {
						id: 'foo',
						value: 'bar'
					};
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results.toJS()).to.deep.equal({ foo: 'bar' });
					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results.toJS()).to.deep.equal({ foo: 'bar' });
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
						return {
							id: 'foo',
							value: 'bar'
						};
					},
					paths: [ p ],
					force: true
				})
				.then(results => {
					expect(results.toJS()).to.deep.equal({});
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
							return {
								id: 'foo',
								value: 'bar'
							};
						}
					},
					paths: [ m ],
					force: true
				})
				.then(results => {
					expect(results.toJS()).to.deep.equal({ foo: 'bar' });
					done();
				})
				.catch(done);
		});

		it('should return multiple results', done => {
			appc.detect
				.scan({
					detectFn: dir => {
						return [
							{
								id: 'foo',
								value: 'bar'
							},
							{
								id: 'baz',
								value: 'wiz'
							}
						];
					},
					paths: [ __dirname ],
					force: true
				})
				.then(results => {
					expect(results.toJS()).to.deep.equal({
						foo: 'bar',
						baz: 'wiz'
					});
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
						return {
							id: 'foo',
							value: 'bar'
						};
					}
					return {
						id: 'baz',
						value: 'wiz'
					};
				},
				paths: [ __dirname ],
				force: true
			};

			appc.detect
				.scan(opts)
				.then(results => {
					expect(results.toJS()).to.deep.equal({ foo: 'bar' });
					return appc.detect
						.scan(opts)
						.then(results => {
							expect(results.toJS()).to.deep.equal({ baz: 'wiz' });
							done();
						});
				})
				.catch(done);
		});
	});
});
