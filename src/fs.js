import fs from 'fs';
import nodePath from 'path';

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
	 * @param {Watcher} [parent] - The parent watcher.
	 */
	constructor(path, parent = null) {
		this.path      = path;
		this.parent    = parent;
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
	 */
	init(isAdd) {
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
			// check to see if we can stat the file
			this.stat = fs.statSync(this.path);

			// we only deal in directories, files are filtered from directory
			// events
			if (!this.stat.isDirectory()) {
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

		this.fswatcher = fs
			.watch(this.path, this.onChange.bind(this))
			.on('error', err => {
				// on Windows, it's possible for the internal FSEvent to return
				// an EPERM exception, so just ignore it
			});

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
	}

	/**
	 * Recursively closes the watcher and all of its children.
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
	 */
	onChange(event, filename) {
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
			evt.stat = fs.statSync(evt.file);
			this.files[filename] = evt.stat;
			evt.action = evt.prevStat ? 'change' : 'add';
		} catch (e) {
			// file was deleted
			evt.action = 'delete';
			if (this.files) {
				delete this.files[filename];
			}
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
	 */
	sendEvent(evt) {
		for (const listener of this.listeners) {
			listener(evt);
		}
	}
}

/**
 * Purges all unneeded watchers.
 */
function cleanupWatchers() {
	function cleanup(watcher) {
		if (watcher.children) {
			for (const filename of Object.keys(watcher.children)) {
				const child = watcher.children[filename];

				if (cleanup(child)) {
					return true;
				}

				// if the child watcher has no listeners or children, then we can safely close it and remove it
				if (child.listeners.length === 0 && (!child.children || Object.keys(child.children).length === 0)) {
					child.close();
					delete watcher.children[filename];
				} else {
					return true;
				}
			}
		}
	}

	cleanup(rootWatcher);

	if (rootWatcher.listeners.length === 0 && (!rootWatcher.children || Object.keys(rootWatcher.children).length === 0)) {
		rootWatcher.close();
	}
}

/**
 * Registers listener with the file path to watch.
 *
 * @param {String} path - The path to the file to watch.
 * @param {Function} listener - The function to call when the watched file
 * changes.
 * @returns {Function} The unwatch function.
 */
export function watch(path, listener) {
	if (typeof path !== 'string') {
		throw new TypeError('Expected path to be a string');
	} else if (typeof listener !== 'function') {
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
			watcher.children[filename] = new Watcher(nodePath.join(watcher.path, filename), watcher);
		}
		watcher = watcher.children[filename];
	}

	// add the listener to the top-level watcher
	if (filename) {
		watcher.listeners.push(evt => {
			if (evt.filename === filename) {
				listener(evt);
			}
		});
	} else {
		watcher.listeners.push(listener);
	}

	// return the unwatch function
	return function unwatch() {
		for (let i = 0; i < watcher.listeners.length; i++) {
			if (watcher.listeners[i] === listener) {
				watcher.listeners.splice(i--, 1);
			}
		}
		cleanupWatchers();
	};
}

/**
 * Closes all watchers.
 */
export function closeAllWatchers() {
	rootWatcher && rootWatcher.close();
}
