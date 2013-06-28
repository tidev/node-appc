var assert = require('assert'),
	appc = require('../lib/appc'), // needed for dump()
	environ = require('../lib/environ');

(function testOsInfo() {
	environ.getOSInfo(function (results) {
		dump(results);
	});
}());
