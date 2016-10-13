import { arrayify, debounce, mutex, randomBytes, sha1, unique } from './util';
import debug from 'debug';
import { EventEmitter } from 'events';
import fs from 'fs';
import { gawk, GawkArray, GawkBase, GawkObject } from 'gawk';
import { isDir, watch } from './fs';
import path from 'path';
import { registry } from './windows';
import { which } from './subprocess';

const log = debug('node-appc:detect');

/**
 * A class that tracks active watchers' unwatch functions. This class is
 * intended to be returned from a `watch()` function.
 *
 * @emits {results} Emits the detection results.
 * @emits {ready} Emitted after the first scan has completed.
 * @emits {error} Emitted when an error occurs.
 */
export class Handle extends EventEmitter {
	/**
	 * Initializes the Watcher instance.
	 */
	constructor() {
		super();
		this.unwatchers = new Map;
	}

	/**
	 * Stops all active watchers.
	 *
	 * @returns {Handle}
	 * @access public
	 */
	stop() {
		let i = 1;
		for (const unwatch of this.unwatchers.values()) {
			if (typeof unwatch === 'function') {
				unwatch();
			}
		}
		this.unwatchers.clear();
		return this;
	}
}

/**
 * A engine for detecting various things. It walks the search paths and calls
 * a `checkDir()` function. The results are accumulated and cached. The engine
 * also supports watching the search paths for changes.
 */
export class Engine {
	/**
	 * Creates the detect engine instance.
	 *
	 * @param {Object} [opts] - Various detect options.
	 * @param {Function} [opts.checkDir] - A function that is called for each
	 * directory when scanning to check if the specified directory is of interest.
	 * @param {Number} [opts.depth=0] - The max depth to scan each search path.
	 * @param {String|Array<String>} [opts.env] - One or more environment variables
	 * containing a path.
	 * @param {String} [opts.exe] - The name of the executable to search the
	 * system path for. If found, the directory is returned and the value will
	 * be marked as the primary path.
	 * @param {Boolean} [opts.multiple=false] - When true, the scanner will
	 * continue to scan paths even after a result has been found.
	 * @param {Function} [opts.processResults] - A function that is called after
	 * the scanning is complete and the results may be modified.
	 * @param {Object|Array<Object>|Function} [opts.registryKeys] - One or more
	 * objects containing the registry `root`, `key`, and value `name` to query
	 * the Windows Registry. If value is a function, it will invoke it and
	 * expect the return value to be a path (string), array of paths (strings),
	 * or a promise that resolves a path or array of paths. This function will
	 * only be invoked on the Windows platform.
	 * @param {Number} [opts.registryPollInterval=30000] - The number of
	 * milliseconds to check for updates in the Windows Registry. Only used when
	 * `detect()` is called with `watch=true`.
	 * @param {String|Array<String>} [opts.paths] - One or more global
	 * search paths to apply to all `detect()` calls.
	 */
	constructor(opts = {}) {
		if (opts.checkDir !== undefined && typeof opts.checkDir !== 'function') {
			throw new TypeError('Expected checkDir to be a function');
		}

		if (opts.exe !== undefined && (typeof opts.exe !== 'string' || !opts.exe)) {
			throw new TypeError('Expected exe to be a non-empty string');
		}

		if (opts.processResults !== undefined && typeof opts.processResults !== 'function') {
			throw new TypeError('Expected processResults() to be a function');
		}

		if (opts.registryKeys === null || (opts.registryKeys !== undefined && typeof opts.registryKeys !== 'function' && typeof opts.registryKeys !== 'object')) {
			throw new TypeError('Expected registryKeys to be an object, array of objects, or a function');
		} else if (Array.isArray(opts.registryKeys) && opts.registryKeys.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !r.key || !r.name)) {
			throw new TypeError('Expected registryKeys to be an array of objects with a "key" and "name"');
		} else if (typeof opts.registryKeys === 'object' && (!opts.registryKeys.key || !opts.registryKeys.name)) {
			throw new TypeError('Expected registryKeys to be an object with a "key" and "name"');
		}

		this.options = {
			checkDir:             typeof opts.checkDir === 'function' ? opts.checkDir : null,
			depth:                Math.max(~~opts.depth, 0),
			env:                  arrayify(opts.env, true),
			exe:                  typeof opts.exe === 'string' && opts.exe || null,
			multiple:             !!opts.multiple,
			processResults:       typeof opts.processResults === 'function' ? opts.processResults : null,
			registryKeys:         (opts.registryKeys && typeof opts.registryKeys === 'object' ? arrayify(opts.registryKeys, true) : []),
			registryKeysFn:       typeof opts.registryKeys === 'function' ? opts.registryKeys : null,
			registryPollInterval: Math.max(~~opts.registryPollInterval || 30000, 0),
			paths:                arrayify(opts.paths, true)
		};

		if (this.options.env.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected env to be a string or an array of strings');
		}

		if (this.options.paths.some(s => !s || typeof s !== 'string')) {
			throw new TypeError('Expected paths to be a string or an array of strings');
		}

		this.initialized = false;
		this.defaultPath = null;
		this.cache = {};
		this.rescanTimer = null;
	}

	/**
	 * Main entry for the detection process flow.
	 *
	 * @param {Object} [opts] - An object with various params.
	 * @param {Boolean} [opts.force=false] - When true, bypasses cache and
	 * rescans the search paths.
	 * @param {Boolan} [opts.gawk=false] - If true, emits the gawked result,
	 * otherwise it emits the plain JavaScript result.
	 * @param {Array} [opts.paths] - One or more paths to search in addition.
	 * @param {Boolean} [opts.redetect=false] - When true, re-runs detection
	 * when a path changes.
	 * @param {Boolean} [opts.watch=false] - When true, watches for changes and
	 * emits the new results when a change occurs.
	 * @returns {Handle}
	 * @access public
	 */
	detect(opts = {}) {
		const handle = new Handle;
		log('detect()');

		// ensure async
		setImmediate(() => {
			if (opts.paths && (typeof opts.paths !== 'string' && (!Array.isArray(opts.paths) || opts.paths.some(s => typeof s !== 'string')))) {
				handle.emit('error', new TypeError('Expected paths to be a string or an array of strings'));
				return;
			}

			Promise.resolve()
				// initialize
				.then(() => this.initialize())

				// build the list of paths to scan
				.then(() => this.getPaths(opts.paths))

				// scan all paths for whatever we're looking for
				.then(paths => this.startScan({ paths, handle, opts }))
				.catch(err => {
					log(err);
					log('  Stopping watchers, emitting error');
					handle.stop();
					handle.emit('error', err);
				});

			if (opts.watch) {
				handle.unwatchers.set('__rescan_timer__', () => {
					clearTimeout(this.rescanTimer);
					this.rescanTimer = null;
				});
			}
		});

		return handle;
	}

	/**
	 * Initializes the engine by cooking the global search paths which are
	 * essentially static.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	initialize() {
		if (this.initialized) {
			return Promise.resolve();
		}

		log('  initialize()');

		return mutex('node-appc/detect/engine/initialize', () => {
			return Promise
				.all([
					// search paths
					Promise.all(
						this.options.paths.map(path => {
							if (typeof path === 'function') {
								return Promise.resolve()
									.then(() => path())
									.then(paths => Promise.all(arrayify(paths, true).map(resolveDir)));
							}
							return resolveDir(path);
						})
					),

					// environment paths
					Promise.all(
						this.options.env.map(name => {
							return resolveDir(process.env[name])
								.then(path => {
									if (path && typeof path === 'object' && !Array.isArray(path)) {
										path.defaultPath && (this.defaultPath = path.defaultPath);
										return path.paths || null;
									}
									return path;
								});
						})
					),

					// executable path
					this.options.exe && which(this.options.exe)
						.then(file => this.defaultPath = path.dirname(fs.realpathSync(file)))
						.catch(() => Promise.resolve())
				])
				.then(([ paths, envPaths, exePath ]) => {
					this.paths = unique(Array.prototype.concat.apply([], paths).filter(p => p));
					this.envPaths = unique(Array.prototype.concat.apply([], envPaths).filter(p => p));
					this.exePath = exePath;

					log('    Found search paths:', this.paths);
					log('    Found env paths:', this.envPaths);
					log('    Found exe paths:', this.exePath);

					this.initialized = true;
				});
		});
	}

	/**
	 * Combines the global search paths with the passed in search paths and
	 * paths from the Windows registry.
	 *
	 * @param {Array<String>} [paths] - The paths to scan.
	 * @returns {Promise}
	 * @access private
	 */
	getPaths(paths) {
		return this.initialize()
			.then(() => {
				return Promise
					.all([
						// global search paths
						process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS ? null : Promise.resolve(this.paths),

						// windows registry paths
						process.env.NODE_APPC_SKIP_GLOBAL_SEARCH_PATHS ? null : this.queryRegistry(),

						// global environment paths
						process.env.NODE_APPC_SKIP_GLOBAL_ENVIRONMENT_PATHS ? null : Promise.resolve(this.envPaths),

						// global executable path
						process.env.NODE_APPC_SKIP_GLOBAL_EXECUTABLE_PATH ? null : Promise.resolve(this.exePath),

						// user paths
						...arrayify(paths, true).map(path => {
							if (typeof path === 'function') {
								return Promise.resolve()
									.then(() => path())
									.then(paths => Promise.all(arrayify(paths, true).map(resolveDir)));
							}
							return resolveDir(path);
						})
					])
					.then(paths => unique(Array.prototype.concat.apply([], paths).filter(p => p)));
			});
	}

	/**
	 * Main logic for scanning and watching for changes.
	 *
	 * @param {Array<String>} paths - The paths to scan.
	 * @param {Handle} handle - The handle to emit events from.
	 * @param {Object} opts - Various scan options.
	 * @returns {Promise}
	 * @access private
	 */
	startScan({ paths, handle, opts }) {
		const sha = handle.lastSha = sha1(paths.sort());
		const id = opts.watch ? randomBytes(10) : sha;

		log('  startScan()');
		log('    paths:', paths);
		log('    id:', id);
		log('    force:', !!opts.force);
		log('    watch:', !!opts.watch);

		const handleError = err => {
			log(err);
			log('  Stopping watchers, emitting error');
			handle.stop();
			handle.emit('error', err);
		};

		let firstTime = true;
		this.lastDefaultPath = this.defaultPath;

		const watchPaths = (prefix, paths, recursive) => {
			const active = {};

			// start watching the paths
			for (const dir of paths) {
				const key = prefix + ':' + dir;
				active[key] = 1;
				if (!handle.unwatchers.has(key)) {
					handle.unwatchers.set(key, watch(dir, { recursive }, debounce(evt => {
						log('  fs event, rescanning', dir);
						this.scan({ id, handle, paths, force: true, onlyPaths: [ dir ] })
							.then(({ container, pathsFound }) => {
								log('    scan complete');
								// no need to emit... the gawk watcher will do it
							})
							.catch(handleError);
					})));
				}
			}

			// remove any inactive watchers
			for (const key of handle.unwatchers.keys()) {
				if (key.indexOf(prefix + ':') === 0 && !active[key]) {
					handle.unwatchers.get(key)();
					handle.unwatchers.delete(key);
				}
			}
		};

		if (opts.watch) {
			watchPaths('watch', paths);
		}

		// windows only... checks the registry to see if paths have changed
		// which will trigger a rescan
		const checkRegistry = () => {
			this.rescanTimer = setTimeout(() => {
				this.getPaths(opts.paths)
					.then(paths => {
						log('    starting scan to see if paths changed');
						log('    paths:', paths);
						const sha = sha1(paths.sort());
						if (handle.lastSha !== sha) {
							log('  paths changed, rescanning', handle.lastSha, sha);
							handle.lastSha = sha;
							return runScan(paths);
						} else if (this.lastDefaultPath !== this.defaultPath) {
							log('  default path changed, rescanning');
							this.lastDefaultPath = this.defaultPath;
							return this.processResults(this.cache[id].get('results')._value, id);
						}
					})
					.then(checkRegistry)
					.catch(handleError);
			}, this.options.registryPollInterval);
		};

		// map of all active fs watchers used to detect a rescan
		const redetectWatchers = new Map;

		const runScan = paths => {
			return this
				.scan({ id, handle, paths, force: opts.force })
				.then(({ container, pathsFound }) => {
					const results = container.get('results');
					log('  scan complete', results.toJS());

					// wire up watch on the gawked results
					if (opts.watch && firstTime) {
						log('  watching gawk object');
						container.watch(evt => {
							const results = container.get('results');
							log('  gawk object changed, emitting:', results.toJS());
							handle.emit('results', opts.gawk ? results : results.toJS());
						});

						if (process.platform === 'win32') {
							log('  watching registry for path changes');
							checkRegistry();
						}
					}

					// if we're watching and redetect is enabled, then watch the
					// found paths for changes
					if (opts.watch && opts.redetect && pathsFound.length) {
						log('  recursively watching paths for changes: ' + pathsFound.join(', '));
						watchPaths('redetect', pathsFound, true);
					}

					// emit the results
					if ((opts.watch && results.toJS()) || (!opts.watch && firstTime)) {
						log('  emitting results:', results.toJS());
						handle.emit('results', opts.gawk ? results : results.toJS());
					}

					// if we're watching, we only emitted results above if there
					// were results, but it's handy to emit an event that lets
					// consumers know that when the first scan has finished
					if (opts.watch && firstTime) {
						handle.emit('ready', opts.gawk ? results : results.toJS());
						firstTime = false;
					}
				})
				.catch(handleError);
		};

		log('  performing initial scan');
		runScan(paths);
	}

	/**
	 * Scans the paths and invokes the specified `checkDir()` function.
	 *
	 * @param {Handle} id - The unique identifier used to cache the results.
	 * @param {Array<String>} paths - The paths to scan.
	 * @param {Boolean} [opts.force=false] - When true, bypasses cache and
	 * rescans the search paths.
	 * @param {Array<String>} [onlyPaths] - When present, it will only scan
	 * these paths and mix the results with all paths which are pulled from cache.
	 * @returns {Promise}
	 * @access private
	 */
	scan({ id, handle, paths, force, onlyPaths }) {
		const results = [];
		const pathsFound = [];
		let index = 0;

		log('  scan()', paths);

		const next = () => {
			const dir = paths[index++];
			if (!this.options.checkDir || !dir) {
				log('    finished scanning paths');
				return;
			}

			log('    scanning ' + index + '/' + paths.length + ': ' + dir);

			// check cache first
			if (this.cache.hasOwnProperty(dir) && (!force || (onlyPaths && onlyPaths.indexOf(dir) === -1))) {
				log('    result for this directory cached, pushing to results');
				if (this.cache[dir]) {
					results.push.apply(results, arrayify(this.cache[dir]));
				}
				return this.options.multiple ? next() : null;
			}

			// not cached, set up our directory walking chain
			const check = (dir, depth) => {
				if (!isDir(dir)) {
					return Promise.resolve();
				}

				log('      checkDir(\'' + dir + '\', ' + depth + ')');

				return Promise.resolve()
					.then(() => this.options.checkDir(dir))
					.then(result => {
						if (result) {
							log('      got result, returning:', result);
							pathsFound.push(dir);
							return result;
						}
						if (depth <= 0) {
							log('      no result, hit max depth, returning');
							return;
						}

						// dir is not what we're looking for, check subdirectories
						const subdirs = [];
						for (const name of fs.readdirSync(dir)) {
							const subdir = path.join(dir, name);
							isDir(subdir) && subdirs.push(subdir);
						}

						if (!subdirs.length) {
							return;
						}

						log('      walking subdirs: [ \'' + subdirs.join('\', \'') + '\' ]');

						return Promise.resolve()
							.then(function nextSubDir() {
								const subdir = subdirs.shift();
								if (subdir) {
									return Promise.resolve()
										.then(() => check(subdir, depth - 1))
										.then(result => result || nextSubDir());
								}
							});
					});
			};

			return check(dir, this.options.depth)
				.then(result => {
					log('      done checking ' + dir);

					// even if we don't have a result, we still cache that there was no result
					log('      caching result');
					this.cache[dir] = result || null;

					if (result) {
						results.push.apply(results, Array.isArray(result) ? result : [ result ]);
					}

					if (!result || this.options.multiple) {
						log('  checking next directory');
						return next();
					}
				});
		};

		log('    entering mutex');
		return mutex('node-appc/detect/engine/' + id + (force ? '/' + randomBytes(5) : ''), () => {
			log('    walking directories:', paths);
			return Promise.resolve()
				.then(next)
				.then(() => {
					log('  scanning found ' + results.length + ' results');
					return this.processResults(results, id);
				});
		}).then(container => {
			log('    exiting mutex');
			return { container, pathsFound };
		});
	}

	/**
	 * Caches the results using the specified id.
	 *
	 * @param {Array|*} results - The results to cache. This is an array by
	 * default, but a custom `processResults()` handler could modify it.
	 * @param {String} id - The identifier of the results in the cache.
	 * @returns {Promise} Resolves a `GawkObject` with a key "results" that
	 * contains the gawked results.
	 * @access private
	 */
	processResults(results, id) {
		log('  processResults() - ' + results.length + ' results');

		let container = this.cache[id];
		if (!container) {
			log('    creating cached GawkObject container');
			container = this.cache[id] = new GawkObject({ results: null });
		}

		let existingValue = container.get('results');

		return Promise.resolve()
			.then(() => {
				if (this.options.multiple) {
					log('    ensuring results is an array of results');
					results = Array.isArray(results) ? results : (results ? [ results ] : []);
					log('    ', results);
				} else {
					log('    ensuring results is a single result');
					results = Array.isArray(results) ? results[0] : (results || null);
					log('    ', results);
				}

				// call processResults() to allow implementations to sort and assign a default
				if (!this.options.processResults) {
					return results;
				}

				existingValue.pause();

				return Promise.resolve()
					.then(() => this.options.processResults(results, existingValue, this))
					.then(newResults => newResults || results);
			})
			.then(results => {
				// ensure that the value is a gawked data type
				if (!(results instanceof GawkBase)) {
					log('    gawking results');
					results = gawk(results);
				}

				if (this.options.multiple) {
					// results will be a gawked array
					if (existingValue instanceof GawkArray) {
						if (results instanceof GawkArray) {
							log('    overriding internal GawkArray value');
							// replace the internal array of the GawkArray and manually trigger the hash
							// to be regenerated and listeners to be notified
							existingValue._value = results._value;
							existingValue.notify();
						} else {
							log('    pushing results into results array');
							existingValue.push(results);
						}
						existingValue.resume();
					} else {
						log('    no existing value, setting');
						container.set('results', results instanceof GawkArray ? results : new GawkArray([ results ]));
					}
				} else {
					// single result
					if (existingValue && existingValue instanceof GawkObject && results instanceof GawkObject) {
						log('    merging results into existing value:', results);
						existingValue.mergeDeep(results);
					} else {
						log('    setting new value:', results);
						container.set('results', results);
					}
				}

				return container;
			});
	}

	/**
	 * Queries the Windows Registyr for the given registry keys or function.
	 * If the paths change, the results will be re-detected.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	queryRegistry() {
		if (process.platform !== 'win32') {
			return;
		}

		return Promise
			.all([
				...this.options.registryKeys.map(reg => {
					return registry
						.get(reg.root || 'HKLM', reg.key, reg.name)
						.catch(err => Promise.resolve());
				}),

				!this.options.registryKeysFn ? null : Promise.resolve()
					.then(() => this.options.registryKeysFn())
			])
			.then(paths => {
				return Array.prototype.concat.apply([], paths.map(p => {
					if (p && typeof p === 'object') {
						this.defaultPath = p.defaultPath;
						return p.paths;
					}
					return p;
				}));
			});
	}
}

/**
 * Resolves a specific directory.
 *
 * @param {String} dir - The directory to resolve.
 * @returns {Promise} Resolves the directory.
 */
function resolveDir(dir) {
	return new Promise((resolve, reject) => {
		if (!dir || typeof dir !== 'string') {
			return resolve();
		}

		fs.stat(dir, (err, stat) => {
			if (err) {
				return resolve(err.code === 'ENOENT' ? dir : null);
			}

			if (!stat.isDirectory()) {
				return resolve();
			}

			fs.realpath(dir, (err, realpath) => resolve(err ? dir : realpath));
		});
	});
}
