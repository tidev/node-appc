module.exports = process.env.APPC_COV
	? require('./lib-cov/appc')
	: require('./lib/appc');