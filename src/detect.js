import fs from 'fs';
import { existsSync } from './fs';
import { which } from './subprocess';
import { mutex, sha1, unique } from './util';
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
 * @param {String|Array} [opts.path] - One or more paths.
 * @returns {Promise}
 */
export function getPaths(opts={}) {
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
 * @returns {Promise}
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
 * @returns {Promise}
 */
function getEnvironmentPath(env) {
	if (!Array.isArray(env)) {
		env = [ env ];
	}

	return Promise.all(env.map(name => name && typeof name === 'string' ? resolveDir(process.env[name]) : null));
}

/**
 * Resolves all of the specified paths.
 *
 * @param {String|Array} paths - The name of the executable to locate.
 * @returns {Promise}
 */
function getUserPaths(paths) {
	if (!Array.isArray(paths)) {
		paths = [ paths ];
	}

	return Promise.all(paths.map(dir => dir && typeof dir === 'string' ? resolveDir(dir) : null));
}

/**
 * Resolves a specific directory.
 *
 * @param {String} dir - The directory to resolve.
 * @returns {Promise}
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
 * A cache of results per path.
 * @type {Object}
 */
let cache = {};

/**
 * Scans one or more paths and calls the specified detect function. Results are
 * then cached per path.
 *
 * @param {Object} opts - Various options.
 * @param {Function} opts.detectFn - A function that detects if a directory is
 * a whatever we're looking for. This function is passed a directory to check
 * and should return a `Promise`.
 * @param {Array} opts.paths - One or more paths to check.
 * @param {Boolean} [opts.depth=1] - The max depth to recurse until the detect
 * function returns a result.
 * @param {Boolean} [opts.force] - When true, bypasses cache and forces a scan.
 * @returns {Promise}
 */
export function scan({ detectFn, paths, depth = 0, force }) {
	if (typeof detectFn !== 'function') {
		return Promise.reject(new TypeError('Expected detectFn to be a function'));
	}

	if (!Array.isArray(paths)) {
		return Promise.reject(new TypeError('Expected paths to be an array'));
	}

	return Promise
		.all(paths.map(dir => mutex(dir, () => new Promise((resolve, reject) => {
			if (cache[dir] && !force) {
				return resolve(cache[dir]);
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
				.then(results => cache[dir] = unique(Array.prototype.concat.call([], results)).sort())
				.then(resolve)
				.catch(reject);
		}))))
		.then(paths => Array.prototype.concat.apply([], paths).filter(p => p));
}

export function resetCache() {
	cache = {};
}
