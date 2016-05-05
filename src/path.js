import path from 'path';

const isWindows = /^win/.test(process.platform);

export const commonSearchPaths = (function () {
	if (isWindows) {
		return ['%SystemDrive%', '%ProgramFiles%', '%ProgramFiles(x86)%', '%ProgramW6432%'];
	}

	let searchDirs = ['/opt', '/opt/local', '/usr', '/usr/local', '~'];
	if (process.platform === 'darwin') {
		searchDirs.push('/Applications', '~/Applications', '~/Library');
	}
	return searchDirs;
}());

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
