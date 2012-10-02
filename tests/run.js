var spawn = require('child_process').spawn,
	exitCode = 0,
	tests = [
		'test-fs.js',
		'test-net.js',
		'test-environ.js',
		'test-plist.js',
		'test-progress.js'
	];

(function next() {
	if (tests.length === 0) {
		process.exit(exitCode);
	}
	
	var file = tests.shift();
	console.log(file);
	
	var proc = spawn('node', [ 'tests/' + file ], { stdio: 'inherit' });
	proc.on('exit', function (code) {
		exitCode += code || 0;
		console.log('');
		next();
	});
}());
