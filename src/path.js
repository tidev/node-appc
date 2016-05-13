import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';
const homeDirRegExp = /^~([\\|/].*)?$/;
const winEnvVarRegExp = /(%([^%]*)%)/g;

/**
 * Resolves a path into an absolute path.
 *
 * @param {...String} segments - The path segments to join and resolve.
 * @returns {String}
 */
export function expand(...segments) {
	segments[0] = segments[0].replace(homeDirRegExp, (process.env.HOME || process.env.USERPROFILE) + '$1');
	if (isWindows) {
		return path.resolve(path.join.apply(null, segments).replace(winEnvVarRegExp, (s, m, n) => {
			return process.env[n] || m;
		}));
	}
	return path.resolve.apply(null, segments);
}

/**
 * A platform specific array of common paths to search for programs. The paths
 * are not guaranteed to exist, but if they do, it will resolve the real path.
 * @type {Array}
 */
export const commonSearchPaths = (function () {
	let dirs;

	if (isWindows) {
		dirs = ['%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%ProgramW6432%'];
	} else {
		dirs = ['/opt', '/opt/local', '/usr', '/usr/local', '~'];
		if (process.platform === 'darwin') {
			dirs.push('/Applications', '~/Applications', '/Library', '~/Library');
		}
	}

	// create a map to remove duplicates
	const searchDirs = {};

	for (const dir of dirs) {
		try {
			searchDirs[fs.realpathSync(expand(dir))] = 1;
		} catch (e) {
			// path does not exist, oh well
			searchDirs[expand(dir)] = 1;
		}
	}

	return Object.keys(searchDirs).sort();
}());
