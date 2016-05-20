import { spawn } from 'child_process';
import _which from 'which';

const isWindows = process.platform === 'win32';

export const exe = (isWindows ? '.exe' : '');
export const cmd = (isWindows ? '.cmd' : '');
export const bat = (isWindows ? '.bat' : '');

/**
 * Wraps `which()` with a promise.
 *
 * @param {String} executable - The executable to find.
 * @returns {Promise}
 */
export function which(executable) {
	return new Promise((resolve, reject) => {
		_which(executable, (err, file) => {
			if (err) {
				reject(err);
			} else {
				resolve(file);
			}
		});
	});
}

/**
 * Runs a command, waits for it to finish, then returns the result.
 *
 * @param {String} cmd - The command to spawn.
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @returns {Promise}
 */
export function run(cmd, args, opts) {
	if (args && !Array.isArray(args)) {
		opts = args;
		args = [];
	}

	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, opts);

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', data => stdout += data.toString());
		child.stderr.on('data', data => stderr += data.toString());

		child.on('close', code => {
			if (!code) {
				resolve({ stdout, stderr });
			} else {
				const err = new Error(`Subprocess exited with code ${code}`);
				err.command = cmd;
				err.args    = args;
				err.code    = code;
				err.stdout  = stdout;
				err.stderr  = stderr;
				reject(err);
			}
		});
	});
}
