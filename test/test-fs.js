import appc from '../src/index';
import del from 'del';
import fs from 'fs-extra';
import path from 'path';
import temp from 'temp';

const isWindows = /^win/.test(process.platform);

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

	describe('isDir()', () => {
		it('should succeed if a directory exists', () => {
			expect(appc.fs.isDir(__dirname)).to.be.true;
		});

		it('should fail if a directory does not exist', () => {
			expect(appc.fs.isDir(path.join(__dirname, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a directory is a file', () => {
			expect(appc.fs.isDir(__filename)).to.be.false;
		});
	});

	describe('isFile()', () => {
		it('should succeed if a file exists', () => {
			expect(appc.fs.isFile(__filename)).to.be.true;
		});

		it('should fail if a file does not exist', () => {
			expect(appc.fs.isFile(path.join(__dirname, 'doesnotexist'))).to.be.false;
		});

		it('should fail if a file is a directory', () => {
			expect(appc.fs.isFile(__dirname)).to.be.false;
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

	describe('watcher', () => {
		beforeEach(function () {
			this.pathsToCleanup = [];
		});

		afterEach(function (done) {
			appc.fs.closeAllWatchers();
			del(this.pathsToCleanup, { force: true }).then(() => done()).catch(done);
		});

		it('should throw error if path is not a string', () => {
			expect(() => {
				appc.fs.watch();
			}).to.throw(TypeError, 'Expected path to be a string');

			expect(() => {
				appc.fs.watch(123);
			}).to.throw(TypeError, 'Expected path to be a string');

			expect(() => {
				appc.fs.watch(function () {});
			}).to.throw(TypeError, 'Expected path to be a string');
		});

		it('should throw error if options is not an object', () => {
			expect(() => {
				appc.fs.watch('foo', 'bar');
			}).to.throw(TypeError, 'Expected opts to be an object');

			expect(() => {
				appc.fs.watch('foo', 123);
			}).to.throw(TypeError, 'Expected opts to be an object');
		});

		it('should throw error if listener is not a function', () => {
			expect(() => {
				appc.fs.watch('foo');
			}).to.throw(TypeError, 'Expected listener to be a function');

			expect(() => {
				appc.fs.watch('foo', null, null);
			}).to.throw(TypeError, 'Expected listener to be a function');

			expect(() => {
				appc.fs.watch('foo', null, 'bar');
			}).to.throw(TypeError, 'Expected listener to be a function');
		});

		it('should watch an existing directory for a new file', done => {
			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');

			appc.fs.watch(tmp, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

			fs.writeFileSync(filename, 'foo!');
		});

		it('should watch an existing directing for a new file that is changed', done => {
			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			let counter = 0;

			appc.fs.watch(tmp, evt => {
				counter++;
				if (counter === 1) {
					// adding the file
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
				} else if (counter === 2) {
					// updating the file
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('change');
					expect(evt.file).to.equal(filename);
					done();
				}
			});

			fs.writeFileSync(filename, 'foo!');
			setTimeout(() => {
				fs.appendFileSync(filename, '\nbar!');
			}, 10);
		});

		it('should watch an existing file for a change', done => {
			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			fs.writeFileSync(filename, 'foo!');

			appc.fs.watch(filename, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('change');
				expect(evt.file).to.equal(filename);
				done();
			});

			setTimeout(() => {
				fs.appendFileSync(filename, '\nbar!');
			}, 10);
		});

		it('should watch a directory that does not exist', function (done) {
			const tmp = temp.path('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');

			appc.fs.watch(tmp, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

			setTimeout(() => {
				this.pathsToCleanup.push(tmp);
				fs.mkdirsSync(tmp);

				setTimeout(() => {
					fs.writeFileSync(filename, 'foo!');
				}, 10);
			}, 10);
		});

		it('should watch a file that does not exist', done => {
			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');

			appc.fs.watch(filename, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				done();
			});

			setTimeout(() => {
				fs.writeFileSync(filename, 'foo!');
			}, 10);
		});

		it('should unwatch a directory', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			const filename2 = path.join(tmp, 'bar.txt');
			let counter = 0;

			const unwatch = appc.fs.watch(tmp, evt => {
				if (++counter === 1) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
					unwatch();
					setTimeout(() => {
						fs.writeFileSync(filename2, 'bar!');
						setTimeout(() => {
							expect(appc.fs.rootWatcher.fswatcher).to.be.null;
							expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
							expect(appc.fs.rootWatcher.children).to.be.null;
							expect(appc.fs.rootWatcher.stat).to.be.null;
							expect(appc.fs.rootWatcher.files).to.be.null;
							done();
						}, 1000);
					}, 10);
				} else {
					done(new Error('Expected onChange to only fire once'));
				}
			});

			setTimeout(() => {
				fs.writeFileSync(filename, 'foo!');
			}, 10);
		});

		it('should unwatch a file', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			let counter = 0;

			const unwatch = appc.fs.watch(filename, evt => {
				counter++;
				if (counter === 1) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
					setTimeout(() => {
						fs.appendFileSync(filename, '\nbar!');
					}, 10);
				} else if (counter === 2) {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('change');
					expect(evt.file).to.equal(filename);
					unwatch();
					setTimeout(() => {
						fs.appendFileSync(filename, '\nbaz!');
						setTimeout(() => {
							expect(appc.fs.rootWatcher.fswatcher).to.be.null;
							expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
							expect(appc.fs.rootWatcher.children).to.be.null;
							expect(appc.fs.rootWatcher.stat).to.be.null;
							expect(appc.fs.rootWatcher.files).to.be.null;
							done();
						}, 1000);
					}, 10);
				} else {
					done(new Error('Expected onChange to only fire once'));
				}
			});

			setTimeout(() => {
				fs.writeFileSync(filename, 'foo!');
			}, 100);
		});

		it('should watch a directory that is deleted and recreated', function (done) {
			const tmp = temp.path('node-appc-test-');
			const fooDir = path.join(tmp, 'foo');
			const barFile = path.join(fooDir, 'bar.txt');
			let counter = 0;

			this.pathsToCleanup.push(tmp);
			fs.mkdirsSync(fooDir);

			appc.fs.watch(fooDir, evt => {
				expect(evt).to.be.an.Object;

				if (evt.action === 'add') {
					expect(evt.file).to.equal(barFile);

					counter++;
					if (counter === 1) {
						del([ tmp ], { force: true });
					} else if (counter === 2) {
						done();
					}
				} else if (evt.action === 'delete') {
					expect(evt.file).to.equal(barFile);

					setTimeout(() => {
						fs.mkdirsSync(fooDir);
						fs.writeFileSync(barFile, 'bar again!');
					}, 100);
				}
			});

			fs.writeFileSync(barFile, 'bar!');
		});

		it('should watch a file that is deleted and recreated', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			fs.writeFileSync(filename, 'foo!');
			let counter = 0;

			appc.fs.watch(filename, evt => {
				counter++;

				try {
					if (counter === 1) {
						expect(evt).to.be.an.Object;
						expect(evt.action).to.equal('change');
						expect(evt.file).to.equal(filename);

						fs.unlinkSync(filename);

					} else if (counter === 2) {
						expect(evt).to.be.an.Object;
						expect(evt.action).to.equal('delete');
						expect(evt.file).to.equal(filename);

						setTimeout(() => {
							fs.writeFileSync(filename, 'bar again!');
						}, 100);

					} else if (counter === 3) {
						expect(evt).to.be.an.Object;
						expect(evt.action).to.equal('add');
						expect(evt.file).to.equal(filename);
						done();
					}
				} catch (e) {
					done(e);
				}
			});

			fs.appendFileSync(filename, '\nbar!');
		});

		it('should have two watchers watching the same directory and unwatch them', done => {
			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');
			let counter = 0;

			const unwatch1 = appc.fs.watch(tmp, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				unwatch();
			});

			const unwatch2 = appc.fs.watch(tmp, evt => {
				expect(evt).to.be.an.Object;
				expect(evt.action).to.equal('add');
				expect(evt.file).to.equal(filename);
				unwatch();
			});

			function unwatch() {
				if (++counter === 2) {
					expect(appc.fs.rootWatcher.fswatcher).to.be.an.Object;
					expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
					expect(appc.fs.rootWatcher.children).to.be.an.Object;
					expect(Object.keys(appc.fs.rootWatcher.children).length).to.be.gt(0);
					expect(appc.fs.rootWatcher.stat).to.be.an.Object;
					expect(appc.fs.rootWatcher.files).to.be.an.Object;
					expect(Object.keys(appc.fs.rootWatcher.files).length).to.be.gt(0);

					unwatch1();

					expect(appc.fs.rootWatcher.fswatcher).to.be.an.Object;
					expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
					expect(appc.fs.rootWatcher.children).to.be.an.Object;
					expect(Object.keys(appc.fs.rootWatcher.children).length).to.be.gt(0);
					expect(appc.fs.rootWatcher.stat).to.be.an.Object;
					expect(appc.fs.rootWatcher.files).to.be.an.Object;
					expect(Object.keys(appc.fs.rootWatcher.files).length).to.be.gt(0);

					unwatch2();

					expect(appc.fs.rootWatcher.fswatcher).to.be.null;
					expect(appc.fs.rootWatcher.listeners).to.have.lengthOf(0);
					expect(appc.fs.rootWatcher.children).to.be.null;
					expect(appc.fs.rootWatcher.stat).to.be.null;
					expect(appc.fs.rootWatcher.files).to.be.null;

					done();
				}
			}

			fs.writeFileSync(filename, 'foo!');
		});

		it('should close and re-watch a directory', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const tmp = temp.mkdirSync('node-appc-test-');
			const filename = path.join(tmp, 'foo.txt');

			appc.fs.watch(tmp, evt => {
				done(new Error('First watcher was invoked'));
			});

			setTimeout(() => {
				appc.fs.closeAllWatchers();

				appc.fs.watch(tmp, evt => {
					expect(evt).to.be.an.Object;
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
					done();
				});

				fs.writeFileSync(filename, 'foo!');
			}, 100);
		});

		it('should recursively watch for changes in nested directories', function (done) {
			this.timeout(10000);
			this.slow(5000);

			const tmp = temp.mkdirSync('node-appc-test-');
			const fooDir = path.join(tmp, 'foo');
			const barDir = path.join(fooDir, 'bar');
			const filename = path.join(barDir, 'baz.txt');
			let count = 0;

			appc.fs.watch(tmp, { recursive: true }, evt => {
				count++;
				expect(evt).to.be.an.Object;

				if (count === 1) {
					// "foo" added, add "bar" subdirectory
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(fooDir);
					fs.mkdirSync(barDir);

				} else if (count === 2) {
					// "bar" added, write "baz.txt"
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(barDir);
					fs.writeFileSync(filename, 'foo!');

				} else if (count === 3) {
					// "baz.txt" added, delete "bar" directory
					expect(evt.action).to.equal('add');
					expect(evt.file).to.equal(filename);
					del([ barDir ], { force: true });

				} else if (count >= 4) {
					// "bar" (and "baz.txt") deleted, verify watching has stopped
					expect(evt.action).to.equal('delete');
					if (evt.file === filename) {
						return;
					}
					expect(evt.file).to.equal(barDir);

					let watcher = appc.fs.rootWatcher;
					for (const segment of tmp.replace(path.resolve('/'), '').split(path.sep)) {
						watcher = watcher.children[segment];
						if (!watcher) {
							return done(new Error('Unable to find tmp dir watcher'));
						}
					}

					expect(watcher.files).to.be.an.Object;
					expect(watcher.files).to.have.property('foo');
					expect(watcher.children).to.be.an.Object;
					expect(watcher.children).to.have.property(fooDir);

					const fooWatcher = watcher.children[fooDir];
					expect(fooWatcher.files).to.be.an.Object;
					expect(fooWatcher.files).to.be.empty;
					expect(fooWatcher.children).to.be.an.Object;
					expect(fooWatcher.children).to.be.empty;

					done();
				}
			});

			// create a subdirectory "foo" to kick off the watch
			fs.mkdirSync(fooDir);
		});
	});
});
