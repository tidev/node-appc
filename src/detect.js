import fs from 'fs';
import { existsSync } from './fs';
import { GawkObject } from 'gawk';
import { mutex, sha1 } from './util';
import path from 'path';

/**
 * A cache of paths to GawkObjects containing the results.
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
 * @param {String} [opts.hash] - The hash of all the paths. Used to look up an
 * existing gawked result object.
 * @param {Boolean} [opts.force] - When true, bypasses cache and forces a scan.
 * @returns {Promise}
 */
export function scan({ detectFn, paths, hash, force }) {
	if (typeof detectFn !== 'function') {
		return Promise.reject(new TypeError('Expected detectFn to be a function'));
	}

	if (!Array.isArray(paths)) {
		return Promise.reject(new TypeError('Expected paths to be an array'));
	}

	if (!hash) {
		hash = sha1(JSON.stringify(paths));
	} else if (typeof hash !== 'string') {
		return Promise.reject(new TypeError('Expected hash to be a string'));
	}

	const validPaths = {};

	return Promise
		.all(paths.map(dir => mutex(dir, () => new Promise((resolve, reject) => {
			if (cache[dir] && !force) {
				validPaths[dir] = 'CACHED';
				return resolve();
			}

			if (!existsSync(dir)) {
				validPaths[dir] = [];
				return resolve();
			}

			Promise.resolve()
				.then(() => detectFn(dir))
				.then(result => {
					if (!result) {
						return Promise.all(fs.readdirSync(dir).map(name => Promise.resolve().then(() => detectFn(path.join(dir, name)))));
					}
					return Array.isArray(result) ? result : [ result ];
				})
				.then(results => {
					validPaths[dir] = results.filter(result => result);
					resolve();
				})
				.catch(reject);
		}))))
		.then(() => {
			// make sure the destination gawk object exists
			let gobj = cache[hash];
			if (!gobj) {
				gobj = cache[hash] = new GawkObject;
			}

			// mix all the results together and keep track of removed keys
			const results = {};
			const removed = {};

			for (const dir of Object.keys(validPaths)) {
				if (validPaths[dir] !== 'CACHED') {
					const cachedIds = cache[dir] ? cache[dir].map(result => result.id) : [];
					const current = cache[dir] = validPaths[dir];

					// what was removed?
					for (const id of cachedIds) {
						if (!current[id]) {
							removed[id] = 1;
						}
					}
				}

				for (const result of cache[dir]) {
					results[result.id] = result.value;
					delete removed[result.id];
				}
			}

			// delete all keys that no longer exist
			for (const id of Object.keys(removed)) {
				gobj.delete(id);
			}

			// update the gawk object with the new/updated keys
			if (Object.keys(results).length) {
				gobj.mergeDeep(results);
			}

			return gobj;
		});
}

export function resetCache() {
	cache = {};
}
