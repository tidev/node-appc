var assert = require('assert'),
	appc = require('../lib/appc'); // needed for dump()

(function() {
	console.log('Progress test:');
	
	var total = 23;
	
	var bar = new appc.progress('  :paddedPercent [:bar] :etas', {
		complete: '='.cyan,
		incomplete: '.'.grey,
		width: 65,
		total: total
	});
	
	var timer = setInterval(function(){
		bar.tick();
		if (bar.complete) {
			console.log('\nComplete!\n');
			clearInterval(timer);
		}
	}, 200);
}());
