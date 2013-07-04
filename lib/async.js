/**
 * Adds context support to the 'async' library.
 *
 * @module async
 *
 * @copyright
 * Copyright (c) 2009-2013 by Appcelerator, Inc. All Rights Reserved.
 *
 * @license
 * Licensed under the terms of the Apache Public License
 * Please see the LICENSE included with this distribution for details.
 */

var async = require('async');

/**
 * Runs multiple tasks in parallel.
 * @param {Object} ctx - A context to bind the tasks to
 * @param {Array<Function>} tasks - The array of tasks
 * @param {Function} cb - A callback to call when the tasks complete
 */
exports.parallel = function parallel(ctx, tasks, cb) {
	async.parallel(tasks.map(function (task) {
		return task.bind(ctx);
	}), function () {
		cb.apply(ctx, arguments);
	});
};

/**
 * Runs multiple tasks in series.
 * @param {Object} ctx - A context to bind the tasks to
 * @param {Array<Function>} tasks - The array of tasks
 * @param {Function} cb - A callback to call when the tasks complete
 */
exports.series = function series(ctx, tasks, cb) {
	async.series(tasks.map(function (task) {
		return task.bind(ctx);
	}), function () {
		cb.apply(ctx, arguments);
	});
};