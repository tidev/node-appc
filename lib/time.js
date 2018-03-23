/**
 * Time formatting functions.
 *
 * @module time
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */
'use strict';

/**
 * Formats the time difference between two date objects to easier human readable
 * format.
 * @param {Date} from - The first date
 * @param {Date} to - The second date
 * @param {Object} [opts] - Pretty diff options
 * @param {Boolean} [opts.colorize] - Formats the numeric value in color
 * @param {Boolean} [opts.hideMS] - When true, does not print the milliseconds
 * @param {Boolean} [opts.showFullName] - When true, uses long name, otherwise uses the abbreviation
 * @returns {String} The formatted time difference
 */
exports.prettyDiff = function prettyDiff(from, to, opts) {
	const __n = require('./i18n')(__dirname).__n,
		s = [];
	let delta = Math.abs(to - from);

	opts = opts || {};

	const days = Math.floor(delta / (24 * 60 * 60 * 1000));
	days && s.push((opts.colorize ? ('' + days).cyan : days) + (opts.showFullName ? ' ' + __n('day', 'days', days) : 'd'));
	delta %= (24 * 60 * 60 * 1000);

	const hours = Math.floor(delta / (60 * 60 * 1000));
	hours && s.push((opts.colorize ? ('' + hours).cyan : hours) + (opts.showFullName ? ' ' + __n('hour', 'hours', hours) : 'h'));
	delta %= (60 * 60 * 1000);

	const minutes = Math.floor(delta / (60 * 1000));
	minutes && s.push((opts.colorize ? ('' + minutes).cyan : minutes) + (opts.showFullName ? ' ' + __n('minute', 'minutes', minutes) : 'm'));
	delta %= (60 * 1000);

	const seconds = Math.floor(delta / 1000);
	seconds && s.push((opts.colorize ? ('' + seconds).cyan : seconds) + (opts.showFullName ? ' ' + __n('second', 'seconds', seconds) : 's'));
	delta %= 1000;

	if (!opts.hideMS && (s.length === 0 || delta)) {
		s.push((opts.colorize ? ('' + delta).cyan : delta) + 'ms');
	}

	return s.join(' ');
};

/**
 * Creates a ISO-like timestamp.
 * @returns {String} The timestamp
 */
exports.timestamp = function timestamp() {
	return (new Date()).toISOString().replace('Z', '+0000');
};
