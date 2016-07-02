import { spawn } from 'child_process';
import _which from 'which';

const isWindows = process.platform === 'win32';

export const exe = (isWindows ? '.exe' : '');
export const cmd = (isWindows ? '.cmd' : '');
export const bat = (isWindows ? '.bat' : '');

/**
 * Wraps `which()` with a promise.
 *
 * @param {String|Array<String>} executables - An array of executables to search
 * until it finds a valid executable.
 * @returns {Promise} Resolves the specified executable.
 */
export function which(executables) {
	if (!Array.isArray(executables)) {
		executables = [ executables ];
	}

	return Promise.resolve()
		.then(function next() {
			const executable = executables.shift();

			if (!executable) {
				return executables.length ? next() : Promise.reject(new Error('Unable to find executable'));
			}

			return new Promise((resolve, reject) => {
				_which(executable, (err, file) => {
					if (err) {
						next().then(resolve).catch(reject);
					} else {
						resolve(file);
					}
				});
			});
		});
}

/**
 * Runs a command, waits for it to finish, then returns the result.
 *
 * @param {String} cmd - The command to spawn.
 * @param {Array} [args] - An array of arguments to pass to the subprocess.
 * @param {Object} [opts] - Spawn options.
 * @returns {Promise} Resolves the stdout and stderr output.
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
