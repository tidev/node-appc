let Registry = null;

export const registry = {
	query
};

/**
 * Queries the Windows registry.
 *
 * @param {String} hive - The hive to query. Must be "HKLM", "HKCU", "HKCR",
 * "HKU", or "HKCC".
 * @param {String} key - The name of the registry key.
 * @param {String} name - The name of the registry value.
 * @returns {Promise} Resolves the value or null if the key is not found.
 */
function query(hive, key, name) {
	if (process.platform !== 'win32') {
		return Promise.resolve(null);
	}

	if (Registry === null) {
		Registry = require('winreg');
	}

	if (Registry.hives.indexOf(hive) === -1) {
		return Promise.reject(new Error(`Invalid hive "${hive}", must be "HKLM", "HKCU", "HKCR", "HKU", or "HKCC"`));
	}

	return new Promise((resolve, reject) => {
		new Registry({ hive, key })
			.get(name, (err, item) => {
				if (err) {
					reject(err);
				} else {
					resolve(item.value || null);
				}
			});
	});
}
