import autobind from 'autobind-decorator';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

/**
 * Determines if a file or directory exists.
 *
 * @param {String} file - The full path to check if exists.
 * @returns {Boolean}
 */
export function existsSync(file) {
	try {
		fs.statSync(file);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Scan a directory for a specified file.
 *
 * @param {String} dir - The directory to start searching from.
 * @param {String|RegExp} filename - The name of the file to look for.
 * @param {Number} depth - Optional search depth, default 1 level.
 * @returns {String|null}
 */
export function locate(dir, filename, depth) {
	for (const name of fs.readdirSync(dir)) {
		const file = path.join(dir, name);

		try {
			if (fs.statSync(file).isDirectory()) {
				if (typeof depth === undefined || depth > 0) {
					const result = locate(file, filename, typeof depth === undefined ? depth : depth - 1);
					if (result) {
						return result;
					}
				}
			} else if ((typeof filename === 'string' && name === filename) || (filename instanceof RegExp && filename.test(name))) {
				return file;
			}
		} catch (e) {
			// squeltch
		}
	}
	return null;
}

/**
 * Watches multiple directories for changes. Multiple Watcher instances share the same
 */
export class Watcher extends EventEmitter {
	/**
	 * A global map of paths to chokidar FSWatcher instances.
	 * @type {Object}
	 */
	static handles = {};

	/**
	 * Map of paths to wrapped listeners. Used during stop to remove listeners.
	 * @type {Object}
	 */
	wrappers = null;

	/**
	 * Internal flag to make sure we don't stop multiple times.
	 * @type {Boolean}
	 */
	stopped = false;

	/**
	 * Constructs the watcher.
	 *
	 * @param {Object} opts - Options to pass into chokidar.
	 * @param {Array} opts.searchPaths - An array of full-resolved paths to watch.
	 * @param {Function} [transform] - A function to transform an event.
	 */
	constructor(opts, transform) {
		super();

		if (typeof opts !== 'object' || opts === null) {
			throw new TypeError('Expected opts to be an object');
		}

		if (!Array.isArray(opts.searchPaths)) {
			throw new TypeError('Expected search paths to be an array');
		}

		this.opts = opts;
		this.transform = typeof transform === 'function' ? transform : null;
	}

	/**
	 * Starts watching for changes.
	 *
	 * @param {Function} listener - A function to call when changes are detected.
	 * @returns {Promise}
	 * @access public
	 */
	listen(listener) {
		if (this.stopped) {
			throw new Error('This watcher has been stopped');
		}

		if (typeof listener !== 'function') {
			throw new TypeError('Expected listener to be a function');
		}

		if (this.wrappers) {
			throw new Error('Expected listen() to only be called once');
		}
		this.wrappers = {};

		return Promise.all(this.opts.searchPaths.map(originalPath => new Promise((resolve, reject) => {
			let timer;

			// declare our wrapper that wraps the listener and store a reference
			// so we can remove it if we stop watching
			const wrapper = this.wrappers[originalPath] = (evt, path, details) => {
				if (!existsSync(originalPath) || path.indexOf(fs.realpathSync(originalPath)) === 0) {
					clearTimeout(timer);
					timer = setTimeout(() => {
						const info = { originalPath, evt, path, details };
						if (this.transform) {
							this.transform(listener, info);
						} else {
							listener(info);
						}
					}, this.opts.wait || 1000);
				}
			};

			const ready = () => {
				handle.listenerCount++;
				this.emit('ready', listener);
				handle.on('raw', wrapper);
				resolve(this);
			};

			let handle = Watcher.handles[originalPath];
			if (handle) {
				// we're already watching this path
				ready();
			} else {
				// start watching this path
				handle = Watcher.handles[originalPath] = chokidar.watch(originalPath, this.opts);
				handle.listenerCount = 0;
				handle.on('ready', ready);
			}
		})));
	}

	/**
	 * Stops watching and emitting filesystem changes to the search paths
	 * specified during construction.
	 *
	 * @access public
	 */
	@autobind
	stop() {
		if (this.stopped) {
			return;
		}
		this.stopped = true;

		for (const path of Object.keys(this.wrappers)) {
			const handle = Watcher.handles[path];
			if (handle) {
				handle.removeListener('raw', this.wrappers[path]);
				delete this.wrappers[path];

				if (--handle.listenerCount <= 0) {
					handle.close();
					delete Watcher.handles[path];
				}
			}
		}
	}
}
