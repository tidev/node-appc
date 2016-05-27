let Registry = null;

export const registry = {
	get: get
};

/**
 * Queries the Windows registry.
 *
 * @param {String} hive - The hive to query. Must be "HKLM", "HKCU", "HKCR",
 * "HKU", or "HKCC".
 * @param {String} key - The name of the registry key.
 * @param {String} name - The name of the registry value.
 * @returns {Promise} Resolves the key value.
 */
function get(hive, key, name) {
	return new Promise((resolve, reject) => {
		if (process.platform !== 'win32') {
			return resolve(null);
		}

		if (Registry === null) {
			Registry = require('winreg');
		}

		if (typeof hive !== 'string' || !hive) {
			throw new TypeError('Expected hive to be a non-empty string');
		}

		if (Registry.HIVES.indexOf(hive) === -1) {
			throw new Error(`Invalid hive "${hive}", must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC"`);
		}

		if (typeof key !== 'string' || !key) {
			throw new TypeError('Expected key to be a non-empty string');
		}

		if (!/^\\/.test(key)) {
			key = '\\' + key;
		}

		if (typeof name !== 'string' || !name) {
			throw new TypeError('Expected name to be a non-empty string');
		}

		new Registry({ hive, key })
			.get(name, (err, item) => {
				if (err && err.code === 1) {
					reject(err);
				} else {
					resolve(item.value);
				}
			});
	});
}
