import autobind from 'autobind-decorator';
import crypto from 'crypto';

/**
 * Deeply merges two JavaScript objects.
 * @param {Object} dest - The object to copy the source into.
 * @param {Object} src - The object to copy.
 * @returns {Object} Returns the dest object.
 */
export function mergeDeep(dest, src) {
	if (typeof dest !== 'object' || dest === null || Array.isArray(dest)) {
		dest = {};
	}

	if (typeof src !== 'object' || src === null || Array.isArray(src)) {
		return dest;
	}

	Object.keys(src).forEach(key => {
		const value = src[key];
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			if (typeof dest[key] !== 'object' || dest[key] === null || Array.isArray(dest[key])) {
				dest[key] = {};
			}
			mergeDeep(dest[key], value);
		} else if (typeof value !== 'undefined') {
			dest[key] = value;
		}
	});

	return dest;
}

const cacheStore = {};

/**
 * Helper function that handles the caching of a value and multiple requests.
 *
 * @param {String} name - The name of the module caching values.
 * @param {Boolean} bypassCache - When true, bypasses the cache and runs the
 * function.
 * @param {Function} fn - A function to call if value is not cached.
 * @returns {Promise}
 */
export function cache(name, bypassCache, fn) {
	const entry = cacheStore[name] || (cacheStore[name] = {
		pending: false,
		requests: [],
		value: null
	});

	if (entry && entry.value && !bypassCache) {
		return Promise.resolve(entry.value);
	}

	if (entry.pending) {
		return new Promise(resolve => {
			entry.requests.push(resolve);
		});
	}

	entry.pending = true;

	return fn().then(value => {
		entry.pending = false;
		entry.value = value;

		for (const resolve of entry.requests) {
			resolve(value);
		}
		entry.requests = [];

		return value;
	});
}

/**
 * Returns the sha1 of the input string.
 *
 * @param {String} str - The string to hash.
 * @returns {String}
 */
export function sha1(str) {
	return crypto.createHash('sha1').update(str).digest('hex');
}

/**
 * Returns the specified number of random bytes as a hex string.
 *
 * @param {Number} howMany - The number of random bytes to generate.
 * @returns {String}
 */
export function randomBytes(howMany) {
	return crypto.randomBytes(howMany).toString('hex');
}
