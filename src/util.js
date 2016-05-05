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

	for (const key of Object.keys(src)) {
		const value = src[key];
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			if (typeof dest[key] !== 'object' || dest[key] === null || Array.isArray(dest[key])) {
				dest[key] = {};
			}
			mergeDeep(dest[key], value);
		} else if (typeof value !== 'undefined') {
			dest[key] = value;
		}
	}

	return dest;
}

export let cacheStore = {};

/**
 * Helper function that handles the caching of a value and multiple requests.
 *
 * @param {String} namespace - The cache namespace.
 * @param {Boolean} [bypassCache=false] - When true, bypasses the cache and runs the
 * function.
 * @param {Function} fn - A function to call if value is not cached.
 * @returns {Promise|*}
 */
export function cache(namespace, bypassCache, fn) {
	if (typeof namespace !== 'string' || !namespace) {
		throw new TypeError('Expected namespace to be a non-empty string');
	}

	if (typeof bypassCache === 'function') {
		fn = bypassCache;
		bypassCache = false;
	}

	if (typeof fn !== 'function') {
		throw new TypeError('Expected fn to be a function');
	}

	const entry = cacheStore[namespace] || (cacheStore[namespace] = {
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

	const store = value => {
		entry.pending = false;
		entry.value = value;

		for (const resolve of entry.requests) {
			resolve(value);
		}
		entry.requests = [];

		return value;
	};

	try {
		const result = fn();
		if (result instanceof Promise) {
			return result.then(store);
		} else {
			return Promise.resolve(result).then(store);
		}
	} catch (err) {
		return Promise.reject(err);
	}
}

/**
 * Clears a key in the cache store or the entire store.
 *
 * @param {String} [namespace] - The cache namespace to clear.
 */
export function clearCache(namespace) {
	if (typeof namespace === 'string' && namespace) {
		delete cacheStore[namespace];
	} else {
		cacheStore = {};
	}
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
