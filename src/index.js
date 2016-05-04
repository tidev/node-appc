import 'source-map-support/register';

export const appc = {};

const modules = [
	'fs',
	'path',
	'subprocess',
	'util'
];

for (const name of modules) {
	Object.defineProperty(appc, name, {
		enumerable: true,
		configurable: true,
		get: () => {
			const module = require('./' + name);
			Object.defineProperty(appc, name, { enumerable: true, value: module });
			return module;
		}
	});
}

export default appc;
