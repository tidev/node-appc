import appc from '../src/index';

describe('util', () => {
	describe('mergeDeep()', () => {
		it('should merge two objects together', () => {
			const obj = appc.util.mergeDeep({ a: 1 }, { b: 2 });
			expect(obj).to.deep.equal({ a: 1, b: 2 });
		});
	});

	describe('cache()', () => {
	});

	describe('sha1()', () => {
	});

	describe('randomBytes()', () => {
	});
});
