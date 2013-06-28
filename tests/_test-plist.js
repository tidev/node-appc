var assert = require('assert'),
	appc = require('../lib/appc'), // needed for dump()
	path = require('path'),
	plist = require('../lib/plist');

(function () {
	var plist = new appc.plist(path.dirname(module.filename) + '/resources/Info.plist');
	
	console.log('\Reading Info.plist'.cyan);
	console.log('toString():')
	console.log(plist.toString().green);
	console.log('\nJSON:')
	console.log(plist.toString('json').green);
	console.log('\nPretty JSON:')
	console.log(plist.toString('pretty-json').green);
	console.log('\nXML:');
	console.log(plist.toString('xml').green);
}());

(function () {
	var plist = new appc.plist(path.dirname(module.filename) + '/resources/InfoBad.plist');
	
	console.log('\Reading InfoBad.plist'.cyan);
	console.log('toString():')
	console.log(plist.toString().green);
	console.log('\nJSON:')
	console.log(plist.toString('json').green);
	console.log('\nPretty JSON:')
	console.log(plist.toString('pretty-json').green);
	console.log('\nXML:');
	console.log(plist.toString('xml').green);
}());

(function () {
	var plist = new appc.plist(path.dirname(module.filename) + '/resources/InfoBig.plist');
	
	console.log('\Reading InfoBig.plist'.cyan);
	console.log('toString():')
	console.log(plist.toString().green);
	console.log('\nJSON:')
	console.log(plist.toString('json').green);
	console.log('\nPretty JSON:')
	console.log(plist.toString('pretty-json').green);
	console.log('\nXML:');
	console.log(plist.toString('xml').green);
}());

(function () {
	var plist = new appc.plist(path.dirname(module.filename) + '/resources/Info.plist');
	
	plist.testkey = 'testvalue';
	plist.testarray = ['testvalue1', 'testvalue2'];
	plist.testdict = {
		'testkey1': 'testvalue1',
		'testkey2': 'testvalue2',
	};
	
	console.log('\Modifying Info.plist'.cyan);
	console.log('toString():')
	console.log(plist.toString().green);
	console.log('\nJSON:')
	console.log(plist.toString('json').green);
	console.log('\nPretty JSON:')
	console.log(plist.toString('pretty-json').green);
	console.log('\nXML:');
	console.log(plist.toString('xml').green);
}());
