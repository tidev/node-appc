/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var async = require('async'),
	hitch = require('./util').hitch;

exports.parallel = function (ctx, tasks, cb) {
	async.parallel(tasks.map(function (task) {
		return hitch(ctx, task);
	}), function () {
		cb.apply(ctx, arguments);
	});
};

exports.series = function (ctx, tasks, cb) {
	async.series(tasks.map(function (task) {
		return hitch(ctx, task);
	}), function () {
		cb.apply(ctx, arguments);
	});
};