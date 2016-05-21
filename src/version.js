/**
 * Compares two versions of any artibrary number of segments.
 *
 * @param {String} v1
 * @param {String} v2
 * @returns {Number}
 */
export function compare(v1, v2) {
	v1 = v1.split('-')[0].split('.');
	v2 = v2.split('-')[0].split('.');
	for (let i = 0, len = Math.max(v1.length, v2.length); i < len; i++) {
		const s1 = ~~v1[i];
		const s2 = ~~v2[i];
		if (s1 > s2) {
			return 1;
		} if (s1 < s2) {
			return -1;
		}
	}
	return 0;
}
