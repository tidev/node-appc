/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

exports.ipaddress = function (all) {
	var ifaces = require('os').networkInterfaces(),
		ips = [],
		re = /^(lo|Loopback).*/;
	
	for (var dev in ifaces) {
		if (!re.test(dev)) {
			ifaces[dev].forEach(function (details) {
				details.family == 'IPv4' && ips.push(details.address);
			});
		}
	}
	
	return all ? ips : ips.shift();
};
