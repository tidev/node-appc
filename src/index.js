if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

export const appc = {};

const modules = {
	detect:     './detect',
	fs:         './fs',
	path:       './path',
	subprocess: './subprocess',
	util:       './util',
	version:    './version'
};

for (const name of Object.keys(modules)) {
	Object.defineProperty(appc, name, {
		enumerable: true,
		configurable: true,
		get: () => {
			const module = require(modules[name]);
			Object.defineProperty(appc, name, { enumerable: true, value: module });
			return module;
		}
	});
}

export default appc;
