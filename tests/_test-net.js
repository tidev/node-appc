var assert = require('assert'),
	appc = require('../lib/appc'), // needed for dump()
	net = require('../lib/net');

(function testInterfaces() {
	net.interfaces(function (results) {
		dump(results);
	});
}());
