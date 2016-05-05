import appc from '../src/index';
import del from 'del';
import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';

temp.track();

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
		const baseDir = path.resolve(__dirname, './mocks/locate');

		it('should find a file with no depth', () => {
			let result = appc.fs.locate(baseDir, 'foo.txt');
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = appc.fs.locate(baseDir, 'bar.txt');
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file using a regex', () => {
			let result = appc.fs.locate(baseDir, /foo\.txt/);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));

			result = appc.fs.locate(baseDir, /bar\.txt/);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'subdir2', 'bar.txt'));
		});

		it('should find a file with depth', () => {
			const result = appc.fs.locate(baseDir, 'foo.txt', 1);
			expect(result).to.be.a.String;
			expect(result).to.equal(path.join(baseDir, 'subdir1', 'foo.txt'));
		});

		it('should not find non-existant file', () => {
			const result = appc.fs.locate(baseDir, 'baz.txt');
			expect(result).to.be.null;
		});

		it('should not find a file with depth', () => {
			const result = appc.fs.locate(baseDir, 'bar.txt', 1);
			expect(result).to.be.null;
		});
	});

	describe('Watcher', () => {
		beforeEach(function () {
			this.cleanup = [];
		});

		afterEach(function (done) {
			temp.cleanupSync();
			del(this.cleanup, { force: true }).then(() => done()).catch(done);
		});

		it('should fail if paths is not an array or string', () => {
			expect(() => {
				new appc.fs.Watcher();
			}).to.throw(TypeError, 'Expected paths to be a string or array of strings');

			expect(() => {
				new appc.fs.Watcher(123);
			}).to.throw(TypeError, 'Expected paths to be a string or array of strings');

			expect(() => {
				new appc.fs.Watcher(null);
			}).to.throw(TypeError, 'Expected paths to be a string or array of strings');

			expect(() => {
				new appc.fs.Watcher('');
			}).to.throw(TypeError, 'Expected paths to not be empty');

			expect(() => {
				new appc.fs.Watcher([]);
			}).to.throw(TypeError, 'Expected paths to be an array containing one or more strings');

			expect(() => {
				new appc.fs.Watcher(['']);
			}).to.throw(TypeError, 'Expected paths to be a string or array of strings');
		});

		it('should fail if options are not an object', () => {
			expect(() => {
				new appc.fs.Watcher('foo', 'bar');
			}).to.throw(TypeError, 'Expected options to be an object');

			expect(() => {
				new appc.fs.Watcher('foo', 123);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should fail if transform is not a function', () => {
			expect(() => {
				new appc.fs.Watcher('foo', {}, 'baz');
			}).to.throw(TypeError, 'Expected transform to be a function');
		});

		it('should be ok if options and transform are not passed in', () => {
			expect(() => {
				new appc.fs.Watcher('foo');
			}).to.not.throw(TypeError);
		});

		it('should be ok if options is not passed in, but transform is', () => {
			expect(() => {
				new appc.fs.Watcher('foo', function () {});
			}).to.not.throw(TypeError);
		});

		it('should fire ready event when watching starts', done => {
			const watcher = new appc.fs.Watcher(__dirname);

			let count = 0;

			const listener = info => {};

			watcher.on('ready', fn => {
				count++;
				expect(fn).to.equal(listener);
			});

			watcher.listen(listener)
				.then(() => {
					watcher.stop();
					expect(count).to.equal(1);
					done();
				})
				.catch(done);
		});

		it('should error if stopped, then listen() is called', done => {
			const watcher = new appc.fs.Watcher(__dirname);
			const listener = info => {};

			watcher.listen(listener)
				.then(() => {
					watcher.stop();
					expect(() => {
						watcher.listen(listener);
					}).to.throw(Error, 'This watcher has been stopped');
					done();
				})
				.catch(done);
		});

		it('should error if listener is not a function', () => {
			const watcher = new appc.fs.Watcher(__dirname);
			expect(() => {
				watcher.listen('foo');
			}).to.throw(Error, 'Expected listener to be a function');
		});

		it('should error if listen() is called more than once', done => {
			const watcher = new appc.fs.Watcher(__dirname);
			const listener = info => {};

			watcher.listen(listener)
				.then(() => {
					expect(() => {
						watcher.listen(listener);
					}).to.throw(Error, 'Expected listen() to only be called once');
					watcher.stop();
					done();
				})
				.catch(done);
		});

		it('should fire ready event when watching has already started', done => {
			const watcher = new appc.fs.Watcher(__dirname);
			const watcher2 = new appc.fs.Watcher(__dirname);

			let count = 0;

			const listener = info => {};

			watcher.on('ready', fn => {
				count++;
				expect(fn).to.equal(listener);
			});

			watcher2.on('ready', fn => {
				count++;
				expect(fn).to.equal(listener);
			});

			watcher.listen(listener)
				.then(() => {
					expect(count).to.equal(1);

					return watcher2.listen(listener)
						.then(() => {
							watcher.stop();
							watcher2.stop();
							expect(count).to.equal(2);
							done();
						});
				})
				.catch(done);
		});

		it('should watch a path that does not exist yet', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.path('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const watcher = new appc.fs.Watcher(tmpDir);

			const listener = info => {
				watcher.stop();

				expect(info).to.be.an.Object;
				expect(info).to.have.keys('originalPath', 'event', 'path', 'details');
				expect(info.originalPath).to.equal(tmpDir);
				expect(info.event).to.equal('modified');
				expect(info.path).to.match(new RegExp('^' + fs.realpathSync(newFile)));
				expect(info.details).to.be.an.Object;

				done();
			};

			watcher.listen(listener)
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});

		it('should watch a path that does not exist yet twice', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.path('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const watcher = new appc.fs.Watcher(tmpDir);
			const watcher2 = new appc.fs.Watcher(tmpDir);
			let counter = 0;

			const listener = info => {
				if (++counter >= 2) {
					watcher.stop();
					watcher2.stop();

					expect(info).to.be.an.Object;
					expect(info).to.have.keys('originalPath', 'event', 'path', 'details');
					expect(info.originalPath).to.equal(tmpDir);
					expect(info.event).to.be.a.String;
					expect(info.path).to.match(new RegExp('^' + fs.realpathSync(newFile)));
					expect(info.details).to.be.an.Object;

					done();
				}
			};

			Promise
				.all([
					watcher.listen(listener),
					watcher2.listen(listener)
				])
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});

		it('should watch a path that already exists', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.mkdirSync('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const watcher = new appc.fs.Watcher(tmpDir);

			const listener = info => {
				watcher.stop();

				expect(info).to.be.an.Object;
				expect(info).to.have.keys('originalPath', 'event', 'path', 'details');
				expect(info.originalPath).to.equal(tmpDir);
				expect(info.event).to.equal('modified');
				expect(info.path).to.match(new RegExp('^' + fs.realpathSync(newFile)));
				expect(info.details).to.be.an.Object;

				done();
			};

			watcher.listen(listener)
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});

		it('should transform info prior to invoking the listener', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.mkdirSync('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const transformer = (listener, info) => {
				listener(path.basename(info.originalPath));
			};

			const watcher = new appc.fs.Watcher(tmpDir, transformer);

			const listener = info => {
				watcher.stop();
				expect(info).to.be.a.String;
				expect(info).to.equal(path.basename(tmpDir));
				done();
			};

			watcher.listen(listener)
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});

		it('should emit error if listener throws an error', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.mkdirSync('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const watcher = new appc.fs.Watcher(tmpDir);

			const listener = info => {
				throw new Error('oh snap');
			};

			watcher.on('error', err => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oh snap');
				done();
			});

			watcher.listen(listener)
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});

		it('should emit error if transformer throws an error', function (done) {
			this.timeout(5000);
			this.slow(5000);

			const tmpDir = temp.mkdirSync('node-appc-test-');
			const newFile = path.join(tmpDir, 'foo.txt');
			this.cleanup.push(tmpDir);

			const watcher = new appc.fs.Watcher(tmpDir, () => {
				throw new Error('oh snap');
			});

			const listener = info => {};

			watcher.on('error', err => {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('oh snap');
				done();
			});

			watcher.listen(listener)
				.then(() => {
					fs.mkdirsSync(tmpDir);
					fs.writeFileSync(newFile);
				})
				.catch(done);
		});
	});
});
