/**
 * Appcelerator Common Library for Node.js
 * Copyright (c) 2012 by Appcelerator, Inc. All Rights Reserved.
 * Please see the LICENSE file for information about licensing.
 */

var interfaces;

exports.interfaces = function (callback) {
	if (interfaces) {
		callback(interfaces);
		return;
	}
	
	var ifaces = require('os').networkInterfaces(),
		exec = require('child_process').exec,
		cmds = ['/sbin/ifconfig', '/bin/ifconfig', 'ifconfig', 'ipconfig /all'];
	
	// need to re-map the interface structure to make room for the mac address
	Object.keys(ifaces).forEach(function (dev) {
		ifaces[dev] = { ipAddresses: ifaces[dev] };
	});
	
	callback = callback || function () {};
	
	(function go() {
		var cmd = cmds.shift();
		if (cmd) {
			exec(cmd, function (err, stdout, stderr) {
				if (err) {
					go();
					return;
				}
				
				var macs = {};
				
				// parse the mac addresses
				stdout.replace(/\r\n|\r/g, '\n')					// remove all \r
					.replace(/\n\n/g, '\n')							// remove double lines
					.replace(/[\n][\t ]/g, ' ')						// if the next line indents, bring it up a line
					.replace(/   /g, '~')							// if indented with spaces, mark with ~ so we can match
					.replace(/ethernet adapter ([^:]*:)\n/ig, '$1')	// on Windows, remove Ethernet adapter
					.split('\n').forEach(function (line) {
						if (line = line.trim()) {
							var m = line.match(/([^:~]*).*?((?:[0-9A-F][0-9A-F][:-]){5}[0-9A-F][0-9A-F])/i);
							m && m.length > 1 && m[2] && (macs[m[1]] = m[2])
						}
					});
				
				// set the mac address, if it exists
				Object.keys(ifaces).forEach(function (dev) {
					macs[dev] && (ifaces[dev].macAddress = macs[dev]);
				});
				
				callback(interfaces = ifaces);
			});
		} else {
			callback(interfaces = ifaces);
		}
	}());
};

exports.urlEncode =  function(obj) {
	var enc = encodeURIComponent,
		pairs = [],
		prop,
		value,
		i,
		l;

	for (prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			Array.isArray(value = obj[prop]) || (value = [value]);
			prop = enc(prop) + "=";
			for (i = 0, l = value.length; i < l;) {
				pairs.push(prop + enc(value[i++]));
			}
		}
	}

	return pairs.join("&");
}
