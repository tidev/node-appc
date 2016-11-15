import debug from 'debug';
import fs from 'fs';
import nodePath from 'path';

const log = debug('node-appc:fs');

/**
 * Node's FSWatcher object instance doesn't track the actual path it's watching,
 * so we'll have to wrap it and add it ourselves.
 */
const origWatch = fs.watch;
fs.watch = function watch(filename) {
	const watcher = origWatch.apply(null, arguments);
	watcher._filename = filename;
	return watcher;
};

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
 * Determines if a directory exists and that it is indeed a directory.
 *
 * @param {String} dir - The directory to check.
 * @returns {Boolean}
 */
export function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squeltch
	}
	return false;
}

/**
 * Determines if a file exists and that it is indeed a file.
 *
 * @param {String} dir - The file to check.
 * @returns {Boolean}
 */
export function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch (e) {
		// squeltch
	}
	return false;
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
	try {
		if (fs.statSync(dir).isDirectory()) {
			for (const name of fs.readdirSync(dir)) {
				const file = nodePath.join(dir, name);
				try {
					if (fs.statSync(file).isDirectory()) {
						if (typeof depth === 'undefined' || depth > 0) {
							const result = locate(file, filename, typeof depth === 'undefined' ? undefined : depth - 1);
							if (result) {
								return result;
							}
						}
					} else if ((typeof filename === 'string' && name === filename) || (filename instanceof RegExp && filename.test(name))) {
						return file;
					}
				} catch (e) {
					// probably a permission issue, go to next file
				}
			}
		}
	} catch (e) {
		// dir does not exist or permission issue
	}
	return null;
}

/**
 * The root watcher. This is not intended to be directly accessed, but may be
 * useful for debugging.
 */
export let rootWatcher = null;

/**
 * Watches files and directories for changes. This is an internal only private
 * class.
 */
export class Watcher {
	/**
	 * Constructs the watcher.
	 *
	 * @param {String} path - The directory to watch.
	 */
	constructor(path) {
		if (!path || typeof path !== 'string') {
			throw new TypeError('Expected path to be a string');
		}

		this.path      = path;
		this.fswatcher = null;
		this.listeners = [];
		this.children  = null;

		this.init();
	}

	/**
	 * Initializes the watcher by stating the file and watching it for changes.
	 * If it's a directory, then it also stats the files in it.
	 *
	 * @param {Boolean} [isAdd=false] - When true, recursively sends out event
	 * notifications for all contained files and directories.
	 * @access private
	 */
	init(isAdd) {
		log('Watcher.init()');
		log('  path = ' + this.path);

		this.stat  = null;
		this.files = null;

		// this should never happen, but just in case we need to close the
		// existing filesystem watcher because we don't know if it's watching
		// a file that has been deleted or moved
		if (this.fswatcher) {
			this.fswatcher.close();
			this.fswatcher = null;
		}

		try {
			// check to see if we can stat the file/directory
			this.stat = fs.statSync(this.path);

			// we only deal in directories, files are filtered from directory
			// events
			if (this.stat.isFile()) {
				this.path = nodePath.dirname(this.path);
				this.stat = fs.statSync(this.path);
			}
		} catch (e) {
			// if we got an ENOENT, then the file doesn't exist so we simply
			// wait for the parent directory to let us know if the file is
			// created
			if (e.code === 'ENOENT') {
				return;
			}
			throw e;
		}

		// we have a directory, so stat every file in it and if this
		// directory was just added, send out notifications for all files
		this.files = {};
		for (const filename of fs.readdirSync(this.path)) {
			const file = nodePath.join(this.path, filename);
			let stat = null;

			try {
				stat = this.files[filename] = fs.statSync(file);
			} catch (e) {
				if (e.code === 'EBUSY') {
					// this can happen on Windows when trying to access files
					// such as the hiberfil.sys
				} else {
					// file doesn't exist? skip it
					continue;
				}
			}

			this.files[filename] = stat;

			if (isAdd) {
				// send notification that this file is new
				this.sendEvent({
					action: 'add',
					filename,
					file,
					stat,
					prevStat: null
				});
			}

			// need to tell any existing children to re-init
			if (this.children && this.children[filename]) {
				this.children[filename].init(isAdd);
			}
		}

		log('  is add? ' + !!isAdd);
		const filenames = Object.keys(this.files);
		log(`  files (${filenames.length}): ${filenames.length ? filenames.join(', ') : '[]'}`);

		this.fswatcher = fs
			.watch(this.path, { persistent: false }, this.onChange.bind(this))
			.on('error', err => {
				// on Windows, it's possible for the internal FSEvent to return
				// an EPERM exception, so just ignore it
			});
	}

	/**
	 * Adds a listener to be notified of any changes.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.ignoreDirectoryTimestampUpdates=false] - When
	 * true, doesn't emit events for directories where only the timestamps are
	 * updated.
	 * @param {Boolean} [opts.recursive=false] - When true, fires listener if
	 * any there are changes in any subdirectories.
	 * @param {Function} listener - The function to call when an event occurs.
	 * @access public
	 */
	addListener(opts, listener) {
		if (typeof opts === 'function') {
			listener = opts;
			opts = {};
		} else if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
			throw TypeError('Expected opts to be an object');
		}

		if (typeof listener !== 'function') {
			throw TypeError('Expected listener to be a function');
		}

		const ignoreDirectoryTimestampUpdates = !!opts.ignoreDirectoryTimestampUpdates;

		if (!opts.recursive) {
			listener.ignoreDirectoryTimestampUpdates = ignoreDirectoryTimestampUpdates;
			this.listeners.push(listener);
			return;
		}

		const add = dir => {
			if (!this.children) {
				this.children = {};
			}

			if (!this.children[dir]) {
				this.children[dir] = new Watcher(nodePath.join(this.path, dir));
			}

			this.children[dir].addListener({ ignoreDirectoryTimestampUpdates, recursive: true }, listener);
		};

		const wrapper = evt => {
			const subdir = nodePath.basename(evt.file);

			if (evt.action === 'add' && evt.stat && evt.stat.isDirectory()) {
				add(subdir);
			} else if (evt.action === 'delete' && this.children && evt.prevStat && evt.prevStat.isDirectory()) {
				if (this.children[subdir]) {
					this.children[subdir].close();
				}
				delete this.children[subdir];
			}

			listener(evt);
		};

		wrapper.ignoreDirectoryTimestampUpdates = ignoreDirectoryTimestampUpdates;
		wrapper.original = listener;

		// recursive... wrap the listener function so that it will be called if
		// any subdirectory has a change
		this.listeners.push(wrapper);

		if (this.files) {
			for (const subdir of Object.keys(this.files)) {
				if (this.files[subdir].isDirectory()) {
					add(subdir);
				}
			}
		}
	}

	/**
	 * Removes a listener.
	 *
	 * @param {Function} listener - The watch listener.
	 * @access public
	 */
	removeListener(listener) {
		for (let i = 0; i < this.listeners.length; i++) {
			if (this.listeners[i].original === listener) {
				// remove from child!
				if (this.children) {
					for (const filename of Object.keys(this.children)) {
						this.children[filename].removeListener(listener);
					}
				}
				this.listeners.splice(i--, 1);
			} else if (this.listeners[i] === listener) {
				this.listeners.splice(i--, 1);
			}
		}
	}

	/**
	 * Recursively closes the watcher and all of its children.
	 *
	 * @access public
	 */
	close() {
		if (this.fswatcher) {
			this.fswatcher.close();
			this.fswatcher = null;
		}

		if (this.children) {
			for (const name of Object.keys(this.children)) {
				this.children[name].close();
				delete this.children[name];
			}
		}

		this.listeners = [];
		this.stat = null;
		this.files = null;
		this.children = null;
	}

	/**
	 * Recursively handles when a file or directory has been deleted. This
	 * will close the filesystem watcher, but keeps listeners and children.
	 *
	 * @access private
	 */
	deleted() {
		if (this.fswatcher) {
			this.fswatcher.close();
			this.fswatcher = null;
		}

		if (this.children) {
			// notify the children that we were deleted
			for (const name of Object.keys(this.children)) {
				this.children[name].deleted();
			}
		}

		if (this.files) {
			// send out notifications for each file deleted
			for (const filename of Object.keys(this.files)) {
				this.sendEvent({
					action: 'delete',
					filename,
					file: nodePath.join(this.path, filename),
					stat: null,
					prevStat: this.files[filename] || null
				});
			}
			this.files = null;
		}

		this.stat = null;
	}

	/**
	 * Processes new filesystem event notifications.
	 *
	 * @param {String} event - The event that triggered the change.
	 * @param {String} filename - The name of the file or directory that changed.
	 * @access private
	 */
	onChange(event, filename) {
		// check that the changed file hasn't been deleted during notification
		if (filename === null) {
			return;
		}

		try {
			// sanity check that this path still exists because apparently Linux
			// will let the watcher know that itself was deleted
			fs.statSync(this.path);
		} catch (e) {
			return;
		}

		const evt = {
			action: null,
			filename,
			file: nodePath.join(this.path, filename),
			stat: null,
			prevStat: this.files && this.files[filename] || null
		};

		try {
			evt.action = evt.prevStat ? 'change' : 'add';
			evt.stat = fs.statSync(evt.file);
			evt.stat.ts = Date.now();
			this.files[filename] = evt.stat;
		} catch (e) {
			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				delete this.files[filename];
			}
		}

		log(`Watcher.onChange('${event}', '${filename}')`);
		log('  action = ' + evt.action);
		log('  file   = ' + evt.file);

		if (evt.stat && evt.prevStat && evt.stat.size === evt.prevStat.size && (evt.stat.ts - evt.prevStat.ts) < 10) {
			log('  dropping redundant event');
			return;
		}

		this.sendEvent(evt);

		let fswatcher;
		if (this.children && (fswatcher = this.children[filename])) {
			if (evt.action === 'add') {
				fswatcher.init(true);
			} else if (evt.action === 'delete') {
				fswatcher.deleted();
			}
		}
	}

	/**
	 * Sends an event notification to all listeners.
	 *
	 * @param {Object} evt - The event payload to send.
	 * @access private
	 */
	sendEvent(evt) {
		log('Watcher.sendEvent()');
		log(`  notifying ${this.listeners.length} listeners`);

		const isTimestampChange = evt.stat && evt.prevStat && evt.stat.isDirectory() && evt.stat.mtime !== evt.prevStat.mtime;

		for (const listener of this.listeners) {
			if (!listener.ignoreDirectoryTimestampUpdates || !isTimestampChange) {
				listener(evt);
			}
		}
	}
}

/**
 * Purges all unneeded watchers.
 */
function cleanupWatchers(watcher) {
	if (watcher.children) {
		// close each child
		for (const filename of Object.keys(watcher.children)) {
			const child = watcher.children[filename];
			if (cleanupWatchers(child)) {
				delete watcher.children[filename];
			}
		}
	}

	if (watcher.listeners.length === 0 && (!watcher.children || Object.keys(watcher.children).length === 0)) {
		watcher.close();
		return true;
	}
}

/**
 * Registers listener with the file path to watch.
 *
 * @param {String} path - The path to the file to watch.
 * @param {Object} [opts] - Various options.
 * @param {Boolean} [opts.ignoreDirectoryTimestampUpdates=false] - When true,
 * doesn't emit events for directories where only the timestamps are updated.
 * @param {Boolean} [opts.recursive=false] - When true, watches for changes in
 * any subdirectories.
 * @param {Function} listener - The function to call when the watched file
 * changes.
 * @returns {Function} The unwatch function.
 */
export function watch(path, opts, listener) {
	if (typeof path !== 'string') {
		throw new TypeError('Expected path to be a string');
	}

	if (typeof opts === 'function') {
		listener = opts;
		opts = {};
	} else if (!opts) {
		opts = {};
	} else if (typeof opts !== 'object' || Array.isArray(opts)) {
		throw new TypeError('Expected opts to be an object');
	}

	if (typeof listener !== 'function') {
		throw new TypeError('Expected listener to be a function');
	}

	path = nodePath.resolve(path);

	// determine if we're dealing with a file or directory
	let filename = null;
	try {
		if (!fs.statSync(path).isDirectory()) {
			filename = nodePath.basename(path);
			path = nodePath.dirname(path);
		}
	} catch (e) {
		// doesn't exist, assume it's a file
	}

	// build the array of path segments
	const segments = path.split(nodePath.sep);
	while (!nodePath.basename(segments[0])) {
		segments.shift();
	}

	// make sure the root watcher exists
	if (!rootWatcher) {
		rootWatcher = new Watcher(nodePath.resolve('/'));
	} else if (!rootWatcher.fswatcher) {
		rootWatcher.init();
	}

	// create the watcher hierarchy
	let watcher = rootWatcher;
	for (const filename of segments) {
		if (!watcher.children) {
			watcher.children = {};
		}
		if (!watcher.children[filename]) {
			watcher.children[filename] = new Watcher(nodePath.join(watcher.path, filename));
		}
		watcher = watcher.children[filename];
	}

	// add the listener to the top-level watcher
	if (filename) {
		watcher.addListener(evt => {
			if (evt.filename === filename) {
				listener(evt);
			}
		});
	} else {
		// watching a directory
		log(`watching directory: ${watcher.path} (ignoreTimestamps: ${!!opts.ignoreDirectoryTimestampUpdates}, recursive: ${!!opts.recursive})`);
		watcher.addListener({
			ignoreDirectoryTimestampUpdates: opts.ignoreDirectoryTimestampUpdates,
			recursive: opts.recursive
		}, listener);
	}

	// return the unwatch function
	return function unwatch() {
		watcher.removeListener(listener);
		cleanupWatchers(rootWatcher);
	};
}

/**
 * Closes all watchers.
 */
export function closeAllWatchers() {
	rootWatcher && rootWatcher.close();
}
