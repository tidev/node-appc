import fs from 'fs';
import { EventEmitter } from 'events';
import { existsSync } from './fs';
import { which } from './subprocess';
import { mutex, unique } from './util';
import path from 'path';

/**
 * Retrieves an array of platform specific paths to search.
 *
 * @param {Object} [opts] - Various options.
 * @param {String|Array} [opts.env] - One or more environment variables
 * containing a path.
 * @param {String} [opts.executable] - The name of the executable to search the
 * system path for. If found, the directory is returned and the value will be
 * marked as the primary path.
 * @param {String|Array} [opts.paths] - One or more paths.
 * @returns {Promise} Resolves an array of paths.
 */
export function getPaths(opts={}) {
	if ((typeof opts.env === 'string' && !opts.env) ||
		(Array.isArray(opts.env) && opts.env.some(p => typeof p !== 'string')) ||
		(opts.env && typeof opts.env !== 'string' && !Array.isArray(opts.env))) {
		return Promise.reject(new TypeError('Expected env to be a string or an array of strings'));
	}

	if ((typeof opts.paths === 'string' && !opts.paths) ||
		(Array.isArray(opts.paths) && opts.paths.some(p => typeof p !== 'string')) ||
		(opts.paths && typeof opts.paths !== 'string' && !Array.isArray(opts.paths))) {
		return Promise.reject(new TypeError('Expected paths to be a string or an array of strings'));
	}

	return Promise
		.all([
			getEnvironmentPath(opts.env),
			getExecutablePath(opts.executable),
			getUserPaths(opts.paths)
		])
		.then(paths => unique(Array.prototype.concat.apply([], paths).filter(p => p)).sort());
}

/**
 * Resolves the directory containing the specified executable.
 *
 * @param {String} [exe] - The name of the executable to locate.
 * @returns {Promise} Resolves the path to the specified executable.
 */
function getExecutablePath(exe) {
	if (exe && typeof exe === 'string') {
		return which(exe)
			.then(file => path.dirname(fs.realpathSync(file)))
			.catch(() => Promise.resolve()); // never fail
	}
}

/**
 * Resolves the path for the specified environment variable.
 *
 * @param {String|Array} [env] - One or more environment variable names.
 * @returns {Promise} Resolves the path for the specified environment variable.
 */
function getEnvironmentPath(env) {
	if (!Array.isArray(env)) {
		env = [ env ];
	}
	return Promise.all(env.map(name => resolveDir(process.env[name])));
}

/**
 * Resolves all of the specified paths.
 *
 * @param {String|Array} paths - The name of the executable to locate.
 * @returns {Promise} Resolves an array of paths.
 */
function getUserPaths(paths) {
	if (!Array.isArray(paths)) {
		paths = [ paths ];
	}
	return Promise.all(paths.map(resolveDir));
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

/**
 * Scans paths for interesting things, then caches them.
 */
export class Scanner {
	constructor() {
		/**
		 * A cache of results per path.
		 * @type {Object}
		 */
		this.cache = {};
	}

	/**
	 * Scans one or more paths and calls the specified detect function. Results
	 * are then cached per path.
	 *
	 * @param {Object} opts - Various options.
	 * @param {Boolean} [opts.depth=1] - The max depth to recurse until the
	 * detect function returns a result.
	 * @param {Function} opts.detectFn - A function that detects if a directory
	 * is whatever we're looking for. This function is passed a directory to
	 * check and should return a `Promise`.
	 * @param {Boolean} [opts.force] - When true, bypasses cache and forces a
	 * scan.
	 * @param {Array} [opts.onlyPaths] - When set, only calls `detectFn` for
	 * these paths, but merges the results with the previously cached results of
	 * other paths.
	 * @param {Array} opts.paths - One or more paths to check.
	 * @returns {Promise} Resolves the value returned from `detectFn`.
	 */
	scan({ detectFn, paths, onlyPaths, depth = 0, force }) {
		if (typeof detectFn !== 'function') {
			return Promise.reject(new TypeError('Expected detectFn to be a function'));
		}

		if (!Array.isArray(paths)) {
			return Promise.reject(new TypeError('Expected paths to be an array'));
		}

		if (onlyPaths && !Array.isArray(onlyPaths)) {
			return Promise.reject(new TypeError('Expected onlyPaths to be an array'));
		}

		return Promise
			.all(paths.map(dir => mutex(dir, () => new Promise((resolve, reject) => {
				if (this.cache[dir] && (!force || onlyPaths && onlyPaths.indexOf(dir) === -1)) {
					return resolve(this.cache[dir]);
				}

				if (!existsSync(dir)) {
					return resolve();
				}

				const detect = (dir, depth) => {
					if (!existsSync(dir)) {
						return;
					}

					depth = ~~depth;

					return Promise.resolve()
						.then(() => detectFn(dir))
						.then(result => {
							if (result) {
								return result;
							}

							if (depth <= 0) {
								return;
							}

							return Promise.all(fs.readdirSync(dir).map(name => detect(path.join(dir, name), depth - 1)));
						});
				};

				Promise.resolve()
					.then(() => detect(dir, depth))
					.then(results => this.cache[dir] = unique(Array.prototype.concat.call([], results)).sort())
					.then(resolve)
					.catch(reject);
			}))))
			.then(paths => Array.prototype.concat.apply([], paths).filter(p => p));
	}
}

/**
 * A class that tracks active watchers' unwatch functions. This class is
 * intended to be returned from a `watch()` function.
 *
 * @emits {results} Emits the detection results.
 * @emits {error} Emitted when an error occurs.
 */
export class Watcher extends EventEmitter {
	/**
	 * Initializes the Watcher instance.
	 */
	constructor() {
		super();
		this.unwatchers = [];
	}

	/**
	 * Adds a unwatch function to the list of functions to call when `stop()` is
	 * called.
	 * @param {Function} unwatch - The unwatch function.
	 * @returns {Watcher}
	 */
	addUnwatch(unwatch) {
		if (typeof unwatch !== 'function') {
			throw new TypeError('Expected unwatch to be a function');
		}

		this.unwatchers.push(unwatch);
		return this;
	}

	/**
	 * Stops all active watchers associated with this handle.
	 * @returns {Watcher}
	 */
	stop() {
		let unwatch;
		while (unwatch = this.unwatchers.shift()) {
			unwatch();
		}
		return this;
	}
}
