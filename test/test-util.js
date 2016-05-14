import appc from '../src/index';

describe('util', () => {
	describe('mergeDeep()', () => {
		it('should merge two objects together', () => {
			const obj = appc.util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});

		it('should create a dest object', () => {
			const obj = appc.util.mergeDeep(null, { b: 2 });
			expect(obj).to.deep.equal({ b: 2 });
		});

		it('should return original dest object if source not an object', () => {
			const orig = { b: 2 };
			const obj = appc.util.mergeDeep(orig);
			expect(obj).to.equal(orig);

			const obj2 = appc.util.mergeDeep(orig, 'foo');
			expect(obj2).to.equal(orig);
		});

		it('should merge deeply nested properties', () => {
			const fn = () => {};

			const obj = appc.util.mergeDeep(
				{
					a: 1,
					d: null,
					g: []
				},
				{
					a: 2,
					b: 3,
					c: [ 'x', 'y', 'z' ],
					d: { fn: fn },
					e: undefined,
					f: null,
					g: { foo: 'bar' }
				}
			);

			expect(obj).to.deep.equal({
				a: 2,
				b: 3,
				c: [ 'x', 'y', 'z' ],
				d: { fn: fn },
				f: null,
				g: { foo: 'bar' }
			});
		});
	});

	describe('mutex()', () => {
		it('should error if name is not a string', done => {
			appc.util.mutex()
				.then(() => done(new Error('Expected rejection')))
				.catch(err => {
					expect(err).to.be.a.TypeError;
					expect(err.message).to.equal('Expected name to be a non-empty string');
					done();
				});
		});

		it('should error if fn is not a function', done => {
			appc.util.mutex('foo', 'bar')
				.then(() => done(new Error('Expected rejection')))
				.catch(err => {
					expect(err).to.be.a.TypeError;
					expect(err.message).to.equal('Expected fn to be a function');
					done();
				});
		});

		it('should queue up multiple calls', done => {
			let count = 0;

			const fn = () => {
				return appc.util.mutex('foo', () => {
					count++;
					return Math.random();
				});
			};

			Promise
				.all([ fn(), fn(), fn() ])
				.then(results => {
					expect(count).to.equal(3);
					expect(results).to.have.lengthOf(3);
					expect(results[1]).to.not.equal(results[0]);
					expect(results[2]).to.not.equal(results[0]);
					done();
				})
				.catch(done);
		});

		it('should queue up multiple async calls', done => {
			let count = 0;

			const fn = () => {
				return appc.util.mutex('foo', () => {
					return new Promise(resolve => {
						count++;
						resolve(Math.random());
					});
				});
			};

			Promise
				.all([ fn(), fn(), fn() ])
				.then(results => {
					expect(count).to.equal(1);
					expect(results).to.have.lengthOf(3);
					expect(results[1]).to.equal(results[0]);
					expect(results[2]).to.equal(results[0]);
					done();
				})
				.catch(done);
		});

		it('should catch errors', done => {
			appc.util
				.mutex('foo', () => {
					throw new Error('oh snap');
				})
				.then(() => {
					done(new Error('Expected error to be caught'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oh snap');
					done();
				});
		});
	});

	describe('cache()', () => {
		afterEach(() => {
			appc.util.clearCache();
		});

		it('should error if namespace is not a string', done => {
			appc.util.cache()
				.then(() => done(new Error('Expected rejection')))
				.catch(err => {
					expect(err).to.be.a.TypeError;
					expect(err.message).to.equal('Expected namespace to be a non-empty string');
					done();
				});
		});

		it('should error if fn is not a function', done => {
			appc.util.cache('foo', 'bar')
				.then(() => done(new Error('Expected rejection')))
				.catch(err => {
					expect(err).to.be.a.TypeError;
					expect(err.message).to.equal('Expected fn to be a function');
					done();
				});
		});

		it('should cache a value', done => {
			const obj = { foo: 'bar' };
			appc.util.cache('foo', () => obj)
				.then(value => {
					expect(value).to.be.an.Object;
					expect(value).to.equal(obj);
					done();
				})
				.catch(done);
		});

		it('should pull from cache', done => {
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'wiz' };

			appc.util.cache('foo', () => obj)
				.then(value => {
					expect(value).to.be.an.Object;
					expect(value).to.equal(obj);

					return appc.util.cache('foo', () => obj2)
						.then(value2 => {
							expect(value2).to.be.an.Object;
							expect(value2).to.equal(obj);
						});
				})
				.then(() => done())
				.catch(done);
		});

		it('should bypass cache', done => {
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'wiz' };

			appc.util.cache('foo', () => obj)
				.then(value => {
					expect(value).to.be.an.Object;
					expect(value).to.equal(obj);

					return appc.util.cache('foo', true, () => obj2)
						.then(value2 => {
							expect(value2).to.be.an.Object;
							expect(value2).to.equal(obj2);
						});
				})
				.then(() => done())
				.catch(done);
		});

		it('should queue up multiple calls', done => {
			const obj = { foo: 'bar' };
			let count = 0;

			const fn = () => {
				return appc.util
					.cache('foo', () => {
						count++;
						return obj;
					})
					.then(value => {
						expect(value).to.be.an.Object;
						expect(value).to.equal(obj);
					});
			};

			Promise
				.all([ fn(), fn(), fn() ])
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should queue up multiple async calls', done => {
			const obj = { foo: 'bar' };
			let count = 0;

			const fn = () => {
				return appc.util
					.cache('foo', () => new Promise(resolve => {
						count++;
						resolve(obj);
					}))
					.then(value => {
						expect(value).to.be.an.Object;
						expect(value).to.equal(obj);
					});
			};

			Promise
				.all([ fn(), fn(), fn() ])
				.then(() => {
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should catch errors', done => {
			appc.util
				.cache('foo', () => {
					throw new Error('oh snap');
				})
				.then(() => {
					done(new Error('Expected error to be caught'));
				})
				.catch(err => {
					expect(err).to.be.instanceof(Error);
					expect(err.message).to.equal('oh snap');
					done();
				});
		});
	});

	describe('clearCache()', () => {
		afterEach(() => {
			appc.util.clearCache();
		});

		it('should clear a specific namespace', done => {
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'wiz' };

			appc.util.cache('foo', () => obj)
				.then(value => {
					expect(value).to.be.an.Object;
					expect(value).to.equal(obj);

					appc.util.clearCache('foo');

					return appc.util.cache('foo', () => obj2)
						.then(value2 => {
							expect(value2).to.be.an.Object;
							expect(value2).to.equal(obj2);
						});
				})
				.then(() => done())
				.catch(done);
		});

		it('should clear all namespaces', done => {
			const obj = { foo: 'bar' };
			const obj2 = { baz: 'wiz' };

			Promise
				.all([
					appc.util.cache('foo', () => obj).then(value => {
						expect(value).to.be.an.Object;
						expect(value).to.equal(obj);
					}),
					appc.util.cache('bar', () => obj).then(value => {
						expect(value).to.be.an.Object;
						expect(value).to.equal(obj);
					})
				])
				.then(() => {
					appc.util.clearCache();

					return Promise
						.all([
							appc.util.cache('foo', () => obj2).then(value2 => {
								expect(value2).to.be.an.Object;
								expect(value2).to.equal(obj2);
							}),
							appc.util.cache('bar', () => obj2).then(value2 => {
								expect(value2).to.be.an.Object;
								expect(value2).to.equal(obj2);
							})
						]);
				})
				.then(() => done())
				.catch(done);
		});
	});

	describe('sha1()', () => {
		it('should hash a string', () => {
			const h1 = appc.util.sha1('foo');
			expect(h1).to.be.a.String;
			expect(h1).to.have.lengthOf(40);

			const h2 = appc.util.sha1('bar');
			expect(h2).to.be.a.String;
			expect(h2).to.have.lengthOf(40);

			expect(h1).to.not.equal(h2);
		});
	});

	describe('randomBytes()', () => {
		it('should return 0 random bytes', () => {
			const r = appc.util.randomBytes(0);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(0);
		});

		it('should return 1 random byte', () => {
			const r = appc.util.randomBytes(1);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(2);
		});

		it('should return 2 random bytes', () => {
			const r = appc.util.randomBytes(2);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(4);
		});

		it('should return 20 random bytes', () => {
			const r = appc.util.randomBytes(20);
			expect(r).to.be.a.String;
			expect(r).to.have.lengthOf(40);
		});
	});

	describe('unique()', () => {
		it('should return an empty array if input is not an array', () => {
			let r = appc.util.unique();
			expect(r).to.be.an.Array;
			expect(r).to.have.lengthOf(0);

			r = appc.util.unique('foo');
			expect(r).to.be.an.Array;
			expect(r).to.have.lengthOf(0);

			r = appc.util.unique([]);
			expect(r).to.be.an.Array;
			expect(r).to.have.lengthOf(0);
		});

		it('should remove duplicates, null, and undefined elements', () => {
			let r = appc.util.unique(['a', 1, 'b', 'c', 2, 'a', undefined, 'd', 3, 'b', null, 'b', 1, 3]);
			expect(r).to.be.an.Array;
			expect(r).to.deep.equal([1, 2, 3, 'a', 'b', 'c', 'd']);
		});
	});
});
